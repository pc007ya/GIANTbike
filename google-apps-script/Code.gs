/*
 * Archived GIANTbike webhook. The browser no longer submits private records
 * to this receiver. Do not publish a web app configured as Anyone / owner.
 * Updating GitHub does NOT change existing Google Apps Script deployments:
 * the owner must separately review and retire any public deployed version.
 */
function disabledResponse() {
  return ContentService.createTextOutput(JSON.stringify({ok:false,error:"receiver_disabled"}))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet(){ return disabledResponse(); }
function doPost(){ return disabledResponse(); }
