import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Plus, X, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import LinkKBArticleDialog from './LinkKBArticleDialog';

interface LinkedArticle {
  id: string;
  article_id: string;
  link_type: string;
  stage_notes: string | null;
  helped_resolve: boolean | null;
  applied_at: string;
  article_title: string;
  article_category: string | null;
}

interface LinkedArticlesProps {
  issueId: string;
  linkedArticles: LinkedArticle[];
  onRefresh: () => void;
}

const LINK_TYPES: Record<string, { label: string; color: string }> = {
  reference: { label: 'Reference', color: 'bg-gray-500/10 text-gray-600' },
  diagnosis: { label: 'Diagnosis', color: 'bg-blue-500/10 text-blue-600' },
  procedure: { label: 'Procedure', color: 'bg-purple-500/10 text-purple-600' },
  resolution: { label: 'Resolution', color: 'bg-green-500/10 text-green-600' },
  disposal: { label: 'Disposal', color: 'bg-orange-500/10 text-orange-600' },
  vendor_specific: { label: 'Vendor Specific', color: 'bg-yellow-500/10 text-yellow-700' },
};

export default function LinkedArticles({ issueId, linkedArticles, onRefresh }: LinkedArticlesProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleUnlink(linkId: string) {
    const { error } = await supabase.from('kb_article_issues').delete().eq('id', linkId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Article unlinked' });
      onRefresh();
    }
  }

  async function handleToggleHelped(linkId: string, currentValue: boolean | null) {
    const newValue = currentValue === true ? false : currentValue === false ? null : true;

    const { error } = await supabase
      .from('kb_article_issues')
      .update({ helped_resolve: newValue })
      .eq('id', linkId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      onRefresh();
    }
  }

  function getHelpedIcon(helped: boolean | null) {
    if (helped === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (helped === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return null;
  }

  function getHelpedLabel(helped: boolean | null) {
    if (helped === true) return 'Helped';
    if (helped === false) return "Didn't help";
    return 'Mark as helped?';
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Knowledge Base Articles
            </span>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Link Article
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {linkedArticles.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No knowledge base articles linked</p>
              <p className="text-xs mt-1">Link articles to document procedures, resolutions, or references</p>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedArticles.map((link) => {
                const typeInfo = LINK_TYPES[link.link_type] || { label: link.link_type, color: '' };
                return (
                  <div key={link.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/knowledge-base/${link.article_id}`}
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            {link.article_title}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                          {link.article_category && (
                            <Badge variant="outline" className="text-xs">
                              {link.article_category}
                            </Badge>
                          )}
                        </div>
                        {link.stage_notes && (
                          <p className="text-sm text-muted-foreground mt-1">{link.stage_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleToggleHelped(link.id, link.helped_resolve)}
                        >
                          {getHelpedIcon(link.helped_resolve)}
                          <span className="ml-1">{getHelpedLabel(link.helped_resolve)}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUnlink(link.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Linked {format(new Date(link.applied_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LinkKBArticleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        issueId={issueId}
        onLinked={onRefresh}
        existingArticleIds={linkedArticles.map((l) => l.article_id)}
      />
    </>
  );
}
