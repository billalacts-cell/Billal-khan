/**
 * ============================================================================
 * GOOGLE APPS SCRIPT: CALIBRATION REMINDER & OVERDUE ALERT ENGINE
 * ============================================================================
 * 
 * Instructions:
 * 1. Open your Google Spreadsheet (e.g. ID: 1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk)
 * 2. Click Extensions > Apps Script
 * 3. Delete any code in Code.gs, paste this entire file, and click Save (Ctrl+S / Cmd+S)
 * 4. Run `setupTrigger()` once to schedule the daily automatic check at 8:00 AM (Asia/Riyadh)
 * 5. Click Deploy > New deployment > Select type: Web App
 *    - Description: "Calibration Reminder API"
 *    - Execute as: "Me (your email)"
 *    - Who has access: "Anyone" (or "Anyone with Google account")
 * 6. Copy the Web App URL and paste it into your application's Google Apps Script Settings!
 */

// Default configuration constants
var DEFAULT_SPREADSHEET_ID = "1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk";
var DEFAULT_RECIPIENT = "billal.acts@gmail.com";
var TIMEZONE = "Asia/Riyadh";

/**
 * Get active spreadsheet (either container-bound or by ID)
 */
function getTargetSpreadsheet() {
  try {
    var bound = SpreadsheetApp.getActiveSpreadsheet();
    if (bound) return bound;
  } catch (e) {}

  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty("SPREADSHEET_ID") || DEFAULT_SPREADSHEET_ID;
  return SpreadsheetApp.openById(sheetId);
}

/**
 * Finds target sheet tab (looks for Equipment, Calibration, or Form Responses)
 */
function getTargetSheet(ss) {
  var props = PropertiesService.getScriptProperties();
  var configuredTab = props.getProperty("SHEET_TAB_NAME");
  if (configuredTab) {
    var s = ss.getSheetByName(configuredTab);
    if (s) return s;
  }

  var sheets = ss.getSheets();
  // Look for sheets matching common names
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (/calibration|equipment|asset|inventory|tool|form responses/i.test(name)) {
      return sheets[i];
    }
  }
  return sheets[0];
}

/**
 * Returns current date formatted in Asia/Riyadh
 */
function getRiyadhDate(d) {
  var date = d || new Date();
  return Utilities.formatDate(date, TIMEZONE, "yyyy-MM-dd");
}

/**
 * Normalizes header string
 */
function normalizeHeader(h) {
  return String(h || "").toLowerCase().trim().replace(/[\s_\-]+/g, " ");
}

/**
 * Maps header columns dynamically
 */
function getColumnMappings(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return { mappings: {}, headers: [], lastNotifiedCol: -1 };

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var norm = headers.map(normalizeHeader);

  var findIndex = function(patterns) {
    for (var p = 0; p < patterns.length; p++) {
      for (var i = 0; i < norm.length; i++) {
        if (patterns[p].test(norm[i])) return i + 1; // 1-indexed column
      }
    }
    return -1;
  };

  var colMap = {
    id: findIndex([/^equipment\s*(id|no|code)/i, /^asset\s*(no|id|code|tag)/i, /^tag\s*no/i, /^id$/i, /^code$/i, /asset/i, /equipment/i]),
    name: findIndex([/^equipment\s*name/i, /^item\s*name/i, /^description/i, /^instrument/i, /^tool/i, /^name$/i]),
    category: findIndex([/^category/i, /^type/i, /^class/i, /^group/i]),
    dueDate: findIndex([/^calibration\s*due/i, /^next\s*calibration/i, /^calibr.*date/i, /^due\s*date/i, /^expiry\s*date/i]),
    project: findIndex([/^current\s*project/i, /^project/i, /^assigned\s*to/i, /^department/i, /^dept/i]),
    location: findIndex([/^current\s*location/i, /^location/i, /^store/i, /^site/i, /^station/i]),
    serial: findIndex([/^serial\s*(no|number)/i, /^s\/n/i, /^sn/i]),
    lastNotified: findIndex([/^last\s*notified/i, /^notified\s*date/i, /^reminder\s*sent/i])
  };

  // If lastNotified column does not exist, automatically append it
  if (colMap.lastNotified === -1) {
    var newCol = lastCol + 1;
    sheet.getRange(1, newCol).setValue("Last Notified Date");
    colMap.lastNotified = newCol;
    headers.push("Last Notified Date");
  }

  return {
    mappings: colMap,
    headers: headers,
    lastNotifiedCol: colMap.lastNotified
  };
}

/**
 * Calculates calendar day difference between reference date and due date
 */
function getDaysUntilDue(dueDateStr, todayStr) {
  if (!dueDateStr) return null;

  var parts = String(dueDateStr).trim().split("-");
  if (parts.length !== 3) {
    var parsed = new Date(dueDateStr);
    if (isNaN(parsed.getTime())) return null;
    parts = [parsed.getFullYear(), ("0" + (parsed.getMonth() + 1)).slice(-2), ("0" + parsed.getDate()).slice(-2)];
  }

  var dToday = new Date(todayStr + "T00:00:00Z");
  var dDue = new Date(parts[0] + "-" + parts[1] + "-" + parts[2] + "T00:00:00Z");
  if (isNaN(dToday.getTime()) || isNaN(dDue.getTime())) return null;

  var diff = dDue.getTime() - dToday.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/**
 * Standardize date format to YYYY-MM-DD
 */
function standardizeDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, TIMEZONE, "yyyy-MM-dd");
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
  }
  return s;
}

/**
 * Get configured reminder recipients
 */
function getRecipients() {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty("RECIPIENTS");
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  return [DEFAULT_RECIPIENT];
}

/**
 * Save configured reminder recipients
 */
function saveRecipients(recipientList) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("RECIPIENTS", JSON.stringify(recipientList));
  return recipientList;
}

/**
 * Logs reminder email execution to a dedicated sheet tab
 */
function logExecution(ss, logEntry) {
  try {
    var logSheet = ss.getSheetByName("Calibration_Reminder_Logs");
    if (!logSheet) {
      logSheet = ss.insertSheet("Calibration_Reminder_Logs");
      logSheet.getRange(1, 1, 1, 8).setValues([[
        "Timestamp",
        "Riyadh Date",
        "Recipients",
        "Subject",
        "Overdue Count",
        "20d Notice Count",
        "Status",
        "Details"
      ]]);
      logSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
    }

    logSheet.appendRow([
      new Date(),
      logEntry.riyadhDate,
      logEntry.recipients,
      logEntry.subject,
      logEntry.overdueCount,
      logEntry.due20dCount,
      logEntry.status,
      logEntry.details || ""
    ]);
  } catch (err) {
    Logger.log("Failed to write to log sheet: " + err);
  }
}

/**
 * Builds responsive HTML email template
 */
/**
 * Builds responsive HTML email template for 20-Day Reminder Notice
 */
function buildHtmlEmail(riyadhDate, dueItems) {
  // Group by Project
  var projectMap = {};
  for (var i = 0; i < dueItems.length; i++) {
    var itm = dueItems[i];
    var pName = (itm.project && String(itm.project).trim() && String(itm.project).toLowerCase() !== 'in stock')
      ? String(itm.project).trim()
      : (itm.project || 'General / In Stock');
    if (!projectMap[pName]) projectMap[pName] = [];
    projectMap[pName].push(itm);
  }

  var projectSectionsHtml = "";
  var projectKeys = Object.keys(projectMap);

  if (projectKeys.length === 0) {
    projectSectionsHtml = '<p style="font-size: 13px; color: #94a3b8; font-style: italic; text-align: center; padding: 20px 0;">No equipment records due for calibration.</p>';
  } else {
    for (var k = 0; k < projectKeys.length; k++) {
      var pTitle = projectKeys[k];
      var groupItems = projectMap[pTitle];

      var rowsHtml = "";
      for (var j = 0; j < groupItems.length; j++) {
        var dItm = groupItems[j];
        var isExternal = dItm.category === 'External Calibration';
        var badgeStyle = isExternal
          ? 'background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe;'
          : 'background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;';

        rowsHtml += '<tr style="border-bottom: 1px solid #f1f5f9;">' +
          '<td style="padding: 11px 14px; vertical-align: top;"><span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; font-family: monospace; background: #eff6ff; color: #1d4ed8;">' + dItm.id + '</span></td>' +
          '<td style="padding: 11px 14px; vertical-align: top;">' +
            '<div style="font-weight: 700; color: #0f172a; font-size: 13px;">' + dItm.name + '</div>' +
            '<div style="margin-top: 4px;">' +
              '<span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; ' + badgeStyle + '">' +
                (isExternal ? 'External Calibration' : 'Internal Calibration') +
              '</span>' +
              (dItm.location ? '<span style="font-size: 11px; color: #64748b; margin-left: 6px;">• ' + dItm.location + '</span>' : '') +
            '</div>' +
          '</td>' +
          '<td style="padding: 11px 14px; vertical-align: top; font-family: monospace; color: #475569;">' + (dItm.serialNumber || '—') + '</td>' +
          '<td style="padding: 11px 14px; vertical-align: top; font-weight: 700; color: #b45309;">' + dItm.dueDate + '</td>' +
        '</tr>';
      }

      projectSectionsHtml +=
        '<div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff;">' +
          '<div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;">' +
            '<span style="font-size: 13px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">PROJECT: ' + pTitle + '</span>' +
            '<span style="font-size: 11px; color: #64748b; font-weight: 600;">' + groupItems.length + ' item' + (groupItems.length === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">' +
            '<thead>' +
              '<tr style="background: #ffffff; color: #475569; font-weight: 700; text-align: left;">' +
                '<th style="width: 120px; padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px;">Asset ID</th>' +
                '<th style="padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px;">Item Description</th>' +
                '<th style="width: 130px; padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px;">Serial Number</th>' +
                '<th style="width: 110px; padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px;">Due Date</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
          '</table>' +
        '</div>';
    }
  }

  return '<!DOCTYPE html>' +
    '<html><head><meta charset="utf-8"></head>' +
    '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; line-height: 1.5;">' +
      '<div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">' +
        '<div style="background: #0f172a; color: #ffffff; padding: 24px 28px;">' +
          '<h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Calibration 20-Day Reminder Notice</h1>' +
          '<p style="margin: 0; font-size: 13px; color: #94a3b8;">Automated reminder for <strong>Asia/Riyadh</strong> • Date: <strong>' + riyadhDate + '</strong></p>' +
        '</div>' +
        '<div style="padding: 24px 28px;">' +
          '<div style="background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 14px 18px; border-radius: 8px; font-size: 13px; margin-bottom: 24px;">' +
            '<strong>20-Day Calibration Notice:</strong> The following <strong>' + dueItems.length + '</strong> equipment record(s) are due for calibration within <strong>20 calendar days</strong>. Please arrange for calibration certification or service as needed.' +
          '</div>' +
          projectSectionsHtml +
        '</div>' +
        '<div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 11px; color: #64748b;">' +
          'This is a consolidated daily reminder dispatched by My Notes Hub. Notifications are sent exactly 20 calendar days prior to calibration due dates.' +
        '</div>' +
      '</div>' +
    '</body></html>';
}

/**
 * Main routine: Reads spreadsheet, checks due dates, sends email via MailApp
 */
function runDailyCalibrationCheck(force, customRecipients) {
  var ss = getTargetSpreadsheet();
  var sheet = getTargetSheet(ss);
  var riyadhDate = getRiyadhDate();

  var meta = getColumnMappings(sheet);
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return {
      success: true,
      status: "no_data_rows",
      message: "Sheet contains no data rows to check.",
      totalDue: 0,
      totalOverdue: 0,
      notifiedIds: []
    };
  }

  var numCols = sheet.getLastColumn();
  var dataRange = sheet.getRange(2, 1, lastRow - 1, numCols);
  var data = dataRange.getValues();

  var overdueItems = [];
  var dueItems = [];
  var rowsToUpdate = [];

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var rowIndex = r + 2; // 1-indexed row in sheet

    var rawDueDate = meta.mappings.dueDate !== -1 ? row[meta.mappings.dueDate - 1] : "";
    var dueDate = standardizeDate(rawDueDate);
    if (!dueDate) continue;

    var days = getDaysUntilDue(dueDate, riyadhDate);
    if (days === null || days < 0) continue; // Completely exclude overdue items

    var id = meta.mappings.id !== -1 ? String(row[meta.mappings.id - 1] || ("EQ-" + rowIndex)) : ("EQ-" + rowIndex);
    var name = meta.mappings.name !== -1 ? String(row[meta.mappings.name - 1] || "Equipment " + id) : "Equipment " + id;
    var category = meta.mappings.category !== -1 ? String(row[meta.mappings.category - 1] || "Internal Calibration") : "Internal Calibration";
    var location = meta.mappings.location !== -1 ? String(row[meta.mappings.location - 1] || "") : "";
    var project = meta.mappings.project !== -1 ? String(row[meta.mappings.project - 1] || "") : "";
    var serial = meta.mappings.serial !== -1 ? String(row[meta.mappings.serial - 1] || "—") : "—";
    var lastNotified = meta.mappings.lastNotified !== -1 ? standardizeDate(row[meta.mappings.lastNotified - 1]) : "";

    // Check if already notified for this cycle
    var alreadyNotified = (lastNotified === dueDate);

    if (days >= 0 && days <= 20) {
      // 20-day notice window
      if (!alreadyNotified || force) {
        dueItems.push({
          id: id,
          name: name,
          category: category,
          location: location,
          project: project,
          serialNumber: serial,
          dueDate: dueDate,
          daysUntil: days,
          rowIndex: rowIndex
        });
        rowsToUpdate.push({ rowIndex: rowIndex, dueDate: dueDate });
      }
    }
  }

  var totalEligible = dueItems.length;

  if (totalEligible === 0) {
    logExecution(ss, {
      riyadhDate: riyadhDate,
      recipients: (customRecipients || getRecipients()).join(", "),
      subject: "Calibration 20-Day Reminder Notice – " + riyadhDate,
      overdueCount: 0,
      due20dCount: 0,
      status: "skipped_no_items",
      details: "No 20-day calibration reminder items found today."
    });

    return {
      success: true,
      status: "skipped_no_items",
      message: "No calibration equipment requires 20-day notification today (" + riyadhDate + ").",
      totalDue: 0,
      totalOverdue: 0,
      notifiedIds: []
    };
  }

  // Recipients
  var recipientList = customRecipients && customRecipients.length > 0 ? customRecipients : getRecipients();
  var recipientTo = recipientList.join(", ");

  var subject = "Calibration 20-Day Reminder Notice – " + riyadhDate;

  var htmlBody = buildHtmlEmail(riyadhDate, dueItems);

  // Send real email using MailApp
  try {
    MailApp.sendEmail({
      to: recipientTo,
      subject: subject,
      htmlBody: htmlBody
    });

    // Update Last Notified Date in sheet
    if (meta.lastNotifiedCol !== -1) {
      for (var u = 0; u < rowsToUpdate.length; u++) {
        sheet.getRange(rowsToUpdate[u].rowIndex, meta.lastNotifiedCol).setValue(rowsToUpdate[u].dueDate);
      }
    }

    var notifiedIds = dueItems.map(function(item) { return item.id; });

    logExecution(ss, {
      riyadhDate: riyadhDate,
      recipients: recipientTo,
      subject: subject,
      overdueCount: 0,
      due20dCount: dueItems.length,
      status: "sent",
      details: "Sent to " + recipientTo + " (" + notifiedIds.length + " equipment notified: 20-day notice)"
    });

    return {
      success: true,
      status: "sent",
      isRealSend: true,
      sentVia: "Google Apps Script MailApp",
      message: "Calibration reminder email successfully delivered to " + recipientTo + " (" + totalEligible + " items due in 20 days).",
      totalDue: dueItems.length,
      totalOverdue: 0,
      notifiedIds: notifiedIds,
      log: {
        id: "gas_log_" + Date.now(),
        dateString: riyadhDate,
        sentAt: Date.now(),
        recipientEmail: recipientTo,
        subject: subject,
        totalEquipmentNotified: totalEligible,
        status: "sent"
      }
    };
  } catch (err) {
    logExecution(ss, {
      riyadhDate: riyadhDate,
      recipients: recipientTo,
      subject: subject,
      overdueCount: 0,
      due20dCount: dueItems.length,
      status: "failed",
      details: "MailApp error: " + err.message
    });

    return {
      success: false,
      status: "failed",
      error: "Google Apps Script MailApp failed: " + err.message
    };
  }
}

/**
 * Sends an immediate live test email to the selected recipient
 */
function sendTestCalibrationEmail(targetEmail) {
  var to = targetEmail || getRecipients()[0] || DEFAULT_RECIPIENT;
  var riyadhDate = getRiyadhDate();
  var ss = getTargetSpreadsheet();

  var subject = "[Live Test] Calibration Email Service Connected – " + riyadhDate;
  var htmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: sans-serif; padding: 24px; background: #f8fafc; color: #1e293b;">' +
    '<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">' +
      '<h2 style="color: #16a34a; margin-top: 0;">✓ Google Apps Script MailApp Connected</h2>' +
      '<p>This confirms that your Google Apps Script calibration reminder engine is authorized and active.</p>' +
      '<div style="background: #f1f5f9; padding: 14px 18px; border-radius: 8px; font-size: 13px; margin: 16px 0;">' +
        '<div><strong>Authorized Sender:</strong> ' + Session.getActiveUser().getEmail() + '</div>' +
        '<div><strong>Target Recipient:</strong> ' + to + '</div>' +
        '<div><strong>Spreadsheet Title:</strong> ' + ss.getName() + '</div>' +
        '<div><strong>Timezone:</strong> Asia/Riyadh (' + riyadhDate + ')</div>' +
      '</div>' +
      '<p style="color: #64748b; font-size: 12px; margin-top: 24px;">Overdue alerts and 20-day calibration notices will be delivered directly from your Google account to this inbox.</p>' +
    '</div></body></html>';

  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: htmlBody
    });

    logExecution(ss, {
      riyadhDate: riyadhDate,
      recipients: to,
      subject: subject,
      overdueCount: 0,
      due20dCount: 0,
      status: "test_sent",
      details: "Test email successfully delivered via MailApp"
    });

    return {
      success: true,
      message: "Test email successfully sent to " + to + " via MailApp!"
    };
  } catch (err) {
    return {
      success: false,
      error: "MailApp error: " + err.message
    };
  }
}

/**
 * Creates the daily time-driven trigger running at 8:00 AM Asia/Riyadh
 */
function createDailyCalibrationTrigger() {
  deleteDailyCalibrationTrigger(); // avoid duplicate triggers

  ScriptApp.newTrigger("runDailyCalibrationCheck")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .inTimezone(TIMEZONE)
    .create();

  return {
    success: true,
    message: "Daily time-driven trigger created: Runs every morning at 8:00 AM (" + TIMEZONE + ")."
  };
}

/**
 * Deletes existing triggers
 */
function deleteDailyCalibrationTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runDailyCalibrationCheck") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return { success: true, removedCount: removed };
}

/**
 * Reads spreadsheet records for frontend synchronization
 */
function readSheetRecords() {
  var ss = getTargetSpreadsheet();
  var sheet = getTargetSheet(ss);
  var meta = getColumnMappings(sheet);
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { records: [], total: 0 };
  }

  var numCols = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  var records = [];

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var rowIndex = r + 2;

    var rawDueDate = meta.mappings.dueDate !== -1 ? row[meta.mappings.dueDate - 1] : "";
    var dueDate = standardizeDate(rawDueDate);

    var id = meta.mappings.id !== -1 ? String(row[meta.mappings.id - 1] || ("EQ-" + rowIndex)) : ("EQ-" + rowIndex);
    var name = meta.mappings.name !== -1 ? String(row[meta.mappings.name - 1] || "Equipment " + id) : "Equipment " + id;
    var category = meta.mappings.category !== -1 ? String(row[meta.mappings.category - 1] || "Internal Calibration") : "Internal Calibration";
    var location = meta.mappings.location !== -1 ? String(row[meta.mappings.location - 1] || "") : "";
    var project = meta.mappings.project !== -1 ? String(row[meta.mappings.project - 1] || "") : "";
    var serial = meta.mappings.serial !== -1 ? String(row[meta.mappings.serial - 1] || "") : "";
    var lastNotified = meta.mappings.lastNotified !== -1 ? standardizeDate(row[meta.mappings.lastNotified - 1]) : "";

    records.push({
      id: id,
      name: name,
      category: category,
      currentLocation: location,
      currentProject: project,
      serialNumber: serial,
      calibrationDueDate: dueDate,
      lastNotifiedDueDate: lastNotified || null
    });
  }

  return {
    records: records,
    total: records.length,
    activeSheet: sheet.getName(),
    spreadsheetTitle: ss.getName()
  };
}

/**
 * Security: Validates optional API key passed in request
 */
function checkAuth(e) {
  var props = PropertiesService.getScriptProperties();
  var configuredKey = props.getProperty("API_KEY");
  if (!configuredKey) return true; // No key required if not configured

  var key = "";
  if (e && e.parameter && e.parameter.apiKey) {
    key = e.parameter.apiKey;
  }
  return key === configuredKey;
}

/**
 * Web App GET Request Router
 */
function doGet(e) {
  try {
    if (!checkAuth(e)) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized: Invalid or missing API key." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
    var ss = getTargetSpreadsheet();
    var sheet = getTargetSheet(ss);

    if (action === "ping") {
      var meta = getColumnMappings(sheet);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        service: "Google Apps Script Calibration Email Engine",
        spreadsheetId: ss.getId(),
        spreadsheetTitle: ss.getName(),
        activeSheet: sheet.getName(),
        availableSheets: ss.getSheets().map(function(s) { return s.getName(); }),
        detectedHeaders: meta.headers,
        mappedColumns: meta.mappings,
        timezone: TIMEZONE,
        currentRiyadhDate: getRiyadhDate(),
        recipients: getRecipients(),
        authorizedUser: Session.getActiveUser().getEmail()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getRecipients") {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        recipients: getRecipients()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "readSheetData") {
      return ContentService.createTextOutput(JSON.stringify(readSheetRecords()))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action: " + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Web App POST Request Router
 */
function doPost(e) {
  try {
    if (!checkAuth(e)) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized: Invalid or missing API key." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (ex) {
        body = {};
      }
    }

    var action = body.action || (e && e.parameter && e.parameter.action) || "checkAndSend";

    if (action === "testEmail") {
      var targetEmail = body.recipient || (e && e.parameter && e.parameter.recipient);
      var testRes = sendTestCalibrationEmail(targetEmail);
      return ContentService.createTextOutput(JSON.stringify(testRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "checkAndSend") {
      var force = Boolean(body.force);
      var customRecipients = body.recipients || null;
      var checkRes = runDailyCalibrationCheck(force, customRecipients);
      return ContentService.createTextOutput(JSON.stringify(checkRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "saveRecipients") {
      var recipients = body.recipients || [];
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ error: "Recipients array is required." }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var saved = saveRecipients(recipients);
      return ContentService.createTextOutput(JSON.stringify({ success: true, recipients: saved }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "setupTrigger") {
      var triggerRes = createDailyCalibrationTrigger();
      return ContentService.createTextOutput(JSON.stringify(triggerRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: "Unknown POST action: " + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
