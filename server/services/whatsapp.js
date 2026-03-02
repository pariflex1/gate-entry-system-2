const axios = require('axios');

/**
 * Send a WhatsApp notification to the super admin about a new signup.
 * Uses a simple WhatsApp API call (can be replaced with Business API later).
 * For now, logs the message — actual WhatsApp integration depends on provider.
 */
async function notifySuperAdmin(societyName, adminName, adminEmail, adminMobile) {
    const message = `New Signup - Gate Entry System
Society: ${societyName}
Admin: ${adminName}
Email: ${adminEmail}
Mobile: ${adminMobile}
Approve: InsForge dashboard → society_admins → status = active`;

    const phone = process.env.SUPERADMIN_WHATSAPP;

    // Log the notification (replace with actual WhatsApp Business API call)
    console.log(`[WhatsApp Notification] To: ${phone}`);
    console.log(message);

    // If using a WhatsApp Business API provider, uncomment:
    // try {
    //   await axios.post('https://api.whatsapp-provider.com/send', {
    //     phone,
    //     message,
    //     apiKey: process.env.WHATSAPP_API_KEY,
    //   });
    // } catch (error) {
    //   console.error('WhatsApp send error:', error.message);
    // }

    return { success: true, message };
}

/**
 * Generate a WhatsApp wa.me link for visitor entry alerts
 */
function generateWhatsAppLink(mobile, visitorName, unit, purpose, vehicleNumber, photoUrl) {
    const phone = mobile ? `91${mobile}` : process.env.SUPERADMIN_WHATSAPP;
    const text = encodeURIComponent(
        `Visitor Entry Alert
Name: ${visitorName}
Unit: ${unit || 'N/A'}
Purpose: ${purpose || 'N/A'}
Vehicle: ${vehicleNumber || 'N/A'}
Photo: ${photoUrl || 'N/A'}`
    );
    return `https://wa.me/${phone}?text=${text}`;
}

module.exports = {
    notifySuperAdmin,
    generateWhatsAppLink,
};
