import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, BookOpen, Tag } from 'lucide-react';

interface KBArticle {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  tags: string[] | null;
  status: string;
}

interface LinkKBArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string;
  onLinked: () => void;
  existingArticleIds: string[];
}

const LINK_TYPES = [
  { value: 'reference', label: 'Reference', description: 'General information related to the issue' },
  { value: 'diagnosis', label: 'Diagnosis', description: 'Steps used to identify the problem' },
  { value: 'procedure', label: 'Procedure', description: 'Specific procedure to follow' },
  { value: 'resolution', label: 'Resolution', description: 'How to resolve the issue' },
  { value: 'disposal', label: 'Disposal', description: 'End-of-life/disposal procedure' },
  { value: 'vendor_specific', label: 'Vendor Specific', description: 'Vendor-specific instructions' },
];

export default function LinkKBArticleDialog({
  open,
  onOpenChange,
  issueId,
  onLinked,
  existingArticleIds,
}: LinkKBArticleDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [linkType, setLinkType] = useState('reference');
  const [stageNotes, setStageNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchArticles();
      setSelectedArticle(null);
      setLinkType('reference');
      setStageNotes('');
      setSearchQuery('');
    }
  }, [open]);

  async function fetchArticles() {
    const { data } = await supabase
      .from('kb_articles')
      .select('id, title, summary, category, tags, status')
      .eq('status', 'published')
      .order('title');

    // Filter out already linked articles
    const available = (data || []).filter((a) => !existingArticleIds.includes(a.id));
    setArticles(available);
  }

  const filteredArticles = articles.filter((article) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(query) ||
      article.summary?.toLowerCase().includes(query) ||
      article.category?.toLowerCase().includes(query) ||
      article.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  async function handleLink() {
    if (!selectedArticle) return;

    setSaving(true);

    const { error } = await supabase.from('kb_article_issues').insert({
      article_id: selectedArticle.id,
      issue_id: issueId,
      link_type: linkType,
      stage_notes: stageNotes || null,
      applied_by: user?.id,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Error', description: 'This article is already linked with this type', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      // Log to article history
      await supabase.from('kb_article_history').insert({
        article_id: selectedArticle.id,
        event_type: 'applied_to_issue',
        description: `Linked to issue as "${LINK_TYPES.find((t) => t.value === linkType)?.label}"`,
        changed_by: user?.id,
      });

      toast({ title: 'Success', description: 'Article linked to issue' });
      onLinked();
      onOpenChange(false);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Knowledge Base Article</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Article Selection */}
          {!selectedArticle ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredArticles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2" />
                  <p>No published articles available</p>
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="p-3 border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{article.title}</h4>
                        {article.summary && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {article.summary}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {article.category && (
                            <Badge variant="outline" className="text-xs">
                              {article.category}
                            </Badge>
                          )}
                          {article.tags?.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected Article */}
              <div className="p-3 border rounded-lg bg-primary/5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{selectedArticle.title}</h4>
                    {selectedArticle.summary && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedArticle.summary}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedArticle(null)}>
                    Change
                  </Button>
                </div>
              </div>

              {/* Link Type */}
              <div className="space-y-2">
                <Label>Link Type *</Label>
                <Select value={linkType} onValueChange={setLinkType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <span className="font-medium">{type.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stage Notes */}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  placeholder="Add context about how this article applies to this issue..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedArticle || saving}>
            {saving ? 'Linking...' : 'Link Article'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
