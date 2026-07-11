import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type ContactAffiliation = Tables<'contact_affiliations'> & { contacts: Contact | null };

interface PrimaryContactSelectorProps {
  entityType: 'client' | 'vendor';
  entityId: string;
}

/**
 * "Who's the primary contact for this client/vendor" panel: a Select of
 * every *currently* affiliated person (end_date null), backed directly by
 * contact_affiliations.is_primary (clear-then-set, scoped to this entity).
 * Choosing "None" just clears the current primary without picking a new one.
 */
export default function PrimaryContactSelector({ entityType, entityId }: PrimaryContactSelectorProps) {
  const { toast } = useToast();
  const entityColumn = entityType === 'client' ? 'client_id' : 'vendor_id';

  const [affiliations, setAffiliations] = useState<ContactAffiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchAffiliations();
  }, [entityType, entityId]);

  async function fetchAffiliations() {
    const { data, error } = await supabase
      .from('contact_affiliations')
      .select('*, contacts(*)')
      .eq(entityColumn, entityId)
      .is('end_date', null)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('Error fetching affiliated contacts:', error);
    }
    setAffiliations((data || []) as ContactAffiliation[]);
    setLoading(false);
  }

  const primary = affiliations.find((a) => a.is_primary);

  async function handleChange(value: string) {
    setUpdating(true);

    // Clear-then-set, scoped to this entity only - a person can still be
    // primary elsewhere at the same time (overlapping affiliations, e.g. a
    // contractor at more than one client), so this never touches other orgs.
    await supabase
      .from('contact_affiliations')
      .update({ is_primary: false })
      .eq(entityColumn, entityId)
      .eq('is_primary', true)
      .is('end_date', null);

    if (value !== 'none') {
      const { error } = await supabase
        .from('contact_affiliations')
        .update({ is_primary: true })
        .eq('id', value);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setUpdating(false);
        await fetchAffiliations();
        return;
      }
    }

    toast({ title: 'Success', description: 'Primary contact updated' });
    await fetchAffiliations();
    setUpdating(false);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Primary Contact</Label>
        <div className="h-10 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Primary Contact</Label>
      {affiliations.length > 0 ? (
        <Select value={primary?.id ?? 'none'} onValueChange={handleChange} disabled={updating}>
          <SelectTrigger>
            <SelectValue placeholder="Select a contact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {affiliations.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.contacts?.name ?? 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm text-muted-foreground">
          No contacts affiliated yet. Add contacts in the Contacts tab.
        </p>
      )}
      {primary?.contacts && (
        <div className="text-sm space-y-0.5 pt-1">
          <Link to={`/contacts/${primary.contacts.id}`} className="font-medium hover:underline">
            {primary.contacts.name}
          </Link>
          {primary.contacts.email && <p className="text-muted-foreground">{primary.contacts.email}</p>}
          {primary.contacts.phone && <p className="text-muted-foreground">{primary.contacts.phone}</p>}
        </div>
      )}
    </div>
  );
}
