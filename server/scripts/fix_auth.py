import os

file_path = "d:/Visitor Management System/Gate Entry/gate-entry-system-2/server/routes/auth.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """        const authUserId = authData?.user?.id || null;

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
        }"""

replacement = """        // 2. Fetch the user_profile that was automatically created by the postgres trigger
        const { data: user, error: userErr } = await insforge.database
            .from('user_profile')
            .select('id, email')
            .eq('email', email.toLowerCase())
            .single();

        if (userErr || !user) {
            console.error('user_profile fetch error:', userErr);
            return res.status(500).json({ error: 'Account created but failed to link profile' });
        }"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully replaced.")
else:
    print("Target not found. Doing fuzzy search...")
    # Normalize line endings
    target_norm = target.replace("\r\n", "\n")
    content_norm = content.replace("\r\n", "\n")
    if target_norm in content_norm:
        content_norm = content_norm.replace(target_norm, replacement)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content_norm)
        print("Successfully replaced with normalized line endings.")
    else:
        print("Failed to find target even with normalized endings.")
