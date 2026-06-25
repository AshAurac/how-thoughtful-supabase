import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function FamilyPage({ user }) {
  const queryClient = useQueryClient();
  const [familyName, setFamilyName] = useState('My family');
  const [inviteEmail, setInviteEmail] = useState('');
  const [kidName, setKidName] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      return profiles[0] || null;
    },
    enabled: !!user?.email,
  });

  const { data: family } = useQuery({
    queryKey: ['family', profile?.family_id],
    queryFn: async () => {
      const rows = await base44.entities.Family.filter({ id: profile.family_id });
      return rows[0] || null;
    },
    enabled: !!profile?.family_id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['familyMembers', profile?.family_id],
    queryFn: () => base44.entities.FamilyMember.filter({ family_id: profile.family_id }),
    enabled: !!profile?.family_id,
  });

  const { data: kids = [] } = useQuery({
    queryKey: ['familyKids', profile?.family_id],
    queryFn: () => base44.entities.FamilyManagedProfile.filter({ family_id: profile.family_id }),
    enabled: !!profile?.family_id,
  });

  const callFamily = async (payload, success) => {
    setLoading(true);
    try {
      await base44.functions.invoke('familyMembership', payload);
      toast.success(success);
      setInviteEmail('');
      setKidName('');
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error.message || 'Family update failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!family) {
    return (
      <div className="space-y-6">
        <div>
          <p className="font-accent text-2xl text-muted-foreground mb-1">family</p>
          <h1 className="font-heading font-bold text-3xl text-foreground">Plan together, keep surprises safe</h1>
          <p className="text-muted-foreground mt-2">Family plans include six adult accounts and four managed kid profiles.</p>
        </div>
        <div className="bg-card border border-border rounded-3xl p-5 space-y-3">
          <label className="text-sm font-heading font-semibold text-foreground">Family name</label>
          <input value={familyName} onChange={e => setFamilyName(e.target.value)} className="w-full rounded-full border border-border px-4 py-3 bg-background" />
          <button
            disabled={loading}
            onClick={() => callFamily({ action: 'create_family', name: familyName }, 'Family created.')}
            className="w-full bg-terracotta text-white rounded-full py-3 font-heading font-semibold"
          >
            Create family space
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-accent text-2xl text-muted-foreground mb-1">family</p>
        <h1 className="font-heading font-bold text-3xl text-foreground">{family.name}</h1>
        <p className="text-muted-foreground mt-2">Share occasions deliberately. Private plans stay private unless you choose family visibility.</p>
      </div>

      <div className="bg-card border border-border rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-moss" />
          <h2 className="font-heading font-bold text-xl">Adults</h2>
          <span className="text-xs text-muted-foreground">{members.length}/6</span>
        </div>
        <div className="space-y-2 mb-4">
          {members.map(member => (
            <div key={member.id} className="bg-muted rounded-2xl px-4 py-3 text-sm flex justify-between">
              <span>{member.email}</span>
              <span className="text-muted-foreground">{member.role} · {member.invitation_state}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com" className="flex-1 rounded-full border border-border px-4 py-2 bg-background" />
          <button
            disabled={loading}
            onClick={() => callFamily({ action: 'invite_adult', family_id: family.id, email: inviteEmail }, 'Invite added.')}
            className="bg-ink text-white rounded-full px-4 font-heading font-semibold"
          >
            Invite
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-5 h-5 text-terracotta" />
          <h2 className="font-heading font-bold text-xl">Managed kid profiles</h2>
          <span className="text-xs text-muted-foreground">{kids.length}/4</span>
        </div>
        <div className="space-y-2 mb-4">
          {kids.map(kid => (
            <div key={kid.id} className="bg-muted rounded-2xl px-4 py-3 text-sm">{kid.display_name}</div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={kidName} onChange={e => setKidName(e.target.value)} placeholder="Kid profile name" className="flex-1 rounded-full border border-border px-4 py-2 bg-background" />
          <button
            disabled={loading}
            onClick={() => callFamily({ action: 'add_kid_profile', family_id: family.id, display_name: kidName }, 'Kid profile added.')}
            className="bg-terracotta text-white rounded-full px-4 font-heading font-semibold"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
