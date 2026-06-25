import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { authenticateRequest, corsHeaders, createAdminClient, errorResponse, json, readBoundedJson } from '../_shared/security.ts';

const normaliseEmail = (email: string) => email.trim().toLowerCase();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    const body = await readBoundedJson(req);
    const action = String(body.action || '');
    const email = normaliseEmail(user.email || '');

    if (action === 'create_family') {
      const name = String(body.name || 'My family').trim().slice(0, 80);
      const { data: family, error: familyError } = await admin
        .from('families')
        .insert({ name, owner_email: email, created_by: email })
        .select()
        .single();
      if (familyError) throw familyError;

      const { error: memberError } = await admin.from('family_members').insert({
        family_id: family.id,
        email,
        role: 'owner',
        invitation_state: 'accepted',
        accepted_at: new Date().toISOString(),
      });
      if (memberError) throw memberError;

      await admin.from('user_profiles').update({ family_id: family.id }).or(`created_by.eq.${email},email.eq.${email}`);

      return json({ family });
    }

    const familyId = String(body.family_id || '');
    if (!familyId) return json({ error: 'family_id is required' }, 400);

    const { data: ownerRows, error: ownerError } = await admin
      .from('families')
      .select('*')
      .eq('id', familyId)
      .ilike('owner_email', email);
    if (ownerError) throw ownerError;
    const isOwner = (ownerRows || []).length > 0;

    if (action === 'invite_adult') {
      if (!isOwner) return json({ error: 'Only the family owner can invite members.' }, 403);
      const inviteEmail = normaliseEmail(String(body.email || ''));
      if (!inviteEmail.includes('@')) return json({ error: 'Enter a valid email.' }, 400);

      const { count } = await admin
        .from('family_members')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', familyId)
        .neq('invitation_state', 'removed');
      if ((count || 0) >= 6) return json({ error: 'Family plans include up to six adult accounts.' }, 400);

      const { data, error } = await admin.from('family_members').upsert({
        family_id: familyId,
        email: inviteEmail,
        role: 'adult',
        invitation_state: 'invited',
        invited_by: email,
      }, { onConflict: 'family_id,email' }).select().single();
      if (error) throw error;
      return json({ member: data });
    }

    if (action === 'accept_invite') {
      const { data, error } = await admin
        .from('family_members')
        .update({ invitation_state: 'accepted', accepted_at: new Date().toISOString() })
        .eq('family_id', familyId)
        .ilike('email', email)
        .select()
        .single();
      if (error) throw error;
      await admin.from('user_profiles').update({ family_id: familyId }).or(`created_by.eq.${email},email.eq.${email}`);
      return json({ member: data });
    }

    if (action === 'remove_member') {
      if (!isOwner) return json({ error: 'Only the family owner can remove members.' }, 403);
      const removeEmail = normaliseEmail(String(body.email || ''));
      if (removeEmail === email) return json({ error: 'The owner cannot remove themselves.' }, 400);
      const { data, error } = await admin
        .from('family_members')
        .update({ invitation_state: 'removed' })
        .eq('family_id', familyId)
        .ilike('email', removeEmail)
        .select();
      if (error) throw error;
      await admin.from('user_profiles').update({ family_id: null }).or(`created_by.eq.${removeEmail},email.eq.${removeEmail}`);
      return json({ removed: data?.length || 0 });
    }

    if (action === 'add_kid_profile') {
      if (!isOwner) return json({ error: 'Only the family owner can manage kid profiles.' }, 403);
      const { count } = await admin
        .from('family_managed_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', familyId);
      if ((count || 0) >= 4) return json({ error: 'Family plans include up to four managed kid profiles.' }, 400);

      const { data, error } = await admin.from('family_managed_profiles').insert({
        family_id: familyId,
        display_name: String(body.display_name || '').trim().slice(0, 80),
        relationship: String(body.relationship || '').trim().slice(0, 80) || null,
        birth_year: body.birth_year || null,
        birthday_month: body.birthday_month || null,
        birthday_day: body.birthday_day || null,
        notes: String(body.notes || '').trim() || null,
        created_by: email,
      }).select().single();
      if (error) throw error;
      return json({ profile: data });
    }

    return json({ error: 'Unknown family action.' }, 400);
  } catch (error) {
    return errorResponse(error);
  }
});
