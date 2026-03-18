const fs = require('fs');
const file = 'd:/Visitor Management System/Gate Entry/gate-entry-system-2/server/routes/auth.js';
let content = fs.readFileSync(file, 'utf8');

const target = `        const authUserId = authData?.user?.id || null;

        // 2. Insert into user_profile table with active status
        const { data: user, error: userErr } = await insforge.database
            .from('user_profile')
            .insert({
                email: email.toLowerCase(),
                auth_user_id: authUserId,
                status: 'active',
            })
            .select()
            .single();

        if (userErr) {
            console.error('user_profile insert error:', userErr);
            return res.status(500).json({ error: 'Failed to create account profile' });
        }`;

const replacement = `        // 2. Fetch the user_profile that was automatically created by the postgres trigger
        const { data: user, error: userErr } = await insforge.database
            .from('user_profile')
            .select('id, email')
            .eq('email', email.toLowerCase())
            .single();

        if (userErr || !user) {
            console.error('user_profile fetch error:', userErr);
            return res.status(500).json({ error: 'Account created but failed to link profile' });
        }`;

// Replace ignoring strict whitespaces
const regexTarget = target.replace(/\s+/g, '\\s+');
content = content.replace(new RegExp(regexTarget), replacement);

fs.writeFileSync(file, content);
console.log('Fixed');
