import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Upload, X, FileText, Image, Trash2, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface KBAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface LinkedIssue {
  id: string;
  issue_id: string;
  link_type: string;
  stage_notes: string | null;
  helped_resolve: boolean | null;
  applied_at: string;
  issue_title?: string;
  issue_status?: string;
}

const CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Disposal',
  'Vendor-Specific',
  'Maintenance',
  'Installation',
  'Troubleshooting',
  'General',
];

const LINK_TYPES = [
  { value: 'reference', label: 'Reference' },
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'resolution', label: 'Resolution' },
  { value: 'disposal', label: 'Disposal' },
  { value: 'vendor_specific', label: 'Vendor Specific' },
];

export default function KBArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<KBAttachment[]>([]);
  const [linkedIssues, setLinkedIssues] = useState<LinkedIssue[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [article, setArticle] = useState({
    title: '',
    content: '',
    summary: '',
    category: '',
    tags: [] as string[],
    status: 'draft',
    view_count: 0,
  });

  useEffect(() => {
    if (!isNew && id) {
      fetchArticle();
      fetchAttachments();
      fetchLinkedIssues();
    }
  }, [id, isNew]);

  async function fetchArticle() {
    const { data, error } = await supabase
      .from('kb_articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      toast({ title: 'Error', description: 'Article not found', variant: 'destructive' });
      navigate('/knowledge-base');
    } else {
      setArticle({
        title: data.title,
        content: data.content,
        summary: data.summary || '',
        category: data.category || '',
        tags: data.tags || [],
        status: data.status,
        view_count: data.view_count || 0,
      });

      // Increment view count
      await supabase
        .from('kb_articles')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', id);
    }
    setLoading(false);
  }

  async function fetchAttachments() {
    const { data } = await supabase
      .from('kb_attachments')
      .select('*')
      .eq('article_id', id)
      .order('created_at', { ascending: false });

    setAttachments(data || []);
  }

  async function fetchLinkedIssues() {
    const { data } = await supabase
      .from('kb_article_issues')
      .select('*, issues(title, status)')
      .eq('article_id', id)
      .order('applied_at', { ascending: false });

    if (data) {
      setLinkedIssues(
        data.map((li: any) => ({
          id: li.id,
          issue_id: li.issue_id,
          link_type: li.link_type,
          stage_notes: li.stage_notes,
          helped_resolve: li.helped_resolve,
          applied_at: li.applied_at,
          issue_title: li.issues?.title || 'Unknown Issue',
          issue_status: li.issues?.status || 'unknown',
        }))
      );
    }
  }

  async function handleSave() {
    if (!article.title.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }

    if (!article.content.trim()) {
      toast({ title: 'Error', description: 'Content is required', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const slug = article.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const articleData = {
      title: article.title,
      content: article.content,
      summary: article.summary || null,
      category: article.category || null,
      tags: article.tags.length > 0 ? article.tags : null,
      status: article.status,
      slug,
      updated_by: user?.id,
      published_at: article.status === 'published' ? new Date().toISOString() : null,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('kb_articles')
        .insert({ ...articleData, created_by: user?.id })
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        // Log history
        await supabase.from('kb_article_history').insert({
          article_id: data.id,
          event_type: 'created',
          description: 'Article created',
          changed_by: user?.id,
        });

        toast({ title: 'Success', description: 'Article created' });
        navigate(`/knowledge-base/${data.id}`);
      }
    } else {
      const { error } = await supabase
        .from('kb_articles')
        .update(articleData)
        .eq('id', id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        // Log history
        await supabase.from('kb_article_history').insert({
          article_id: id,
          event_type: 'updated',
          description: 'Article updated',
          changed_by: user?.id,
        });

        toast({ title: 'Success', description: 'Article saved' });
      }
    }
    setSaving(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 10MB', variant: 'destructive' });
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Error', description: 'Only PDF and image files are allowed', variant: 'destructive' });
      return;
    }

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('kb-files')
      .upload(fileName, file);

    if (uploadError) {
      toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('kb-files').getPublicUrl(fileName);

    const { error: dbError } = await supabase.from('kb_attachments').insert({
      article_id: id,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user?.id,
    });

    if (dbError) {
      toast({ title: 'Error', description: dbError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'File uploaded' });
      fetchAttachments();
    }

    setUploading(false);
    e.target.value = '';
  }

  async function handleDeleteAttachment(attachment: KBAttachment) {
    const fileName = attachment.file_url.split('/').pop();
    if (fileName) {
      await supabase.storage.from('kb-files').remove([`${id}/${fileName}`]);
    }

    const { error } = await supabase.from('kb_attachments').delete().eq('id', attachment.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Attachment deleted' });
      fetchAttachments();
    }
  }

  function handleAddTag() {
    const tag = tagInput.trim();
    if (tag && !article.tags.includes(tag)) {
      setArticle({ ...article, tags: [...article.tags, tag] });
      setTagInput('');
    }
  }

  function handleRemoveTag(tag: string) {
    setArticle({ ...article, tags: article.tags.filter((t) => t !== tag) });
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Published</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/knowledge-base">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{isNew ? 'New Article' : article.title}</h1>
          {!isNew && (
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(article.status)}
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {article.view_count} views
              </span>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Article Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={article.title}
                  onChange={(e) => setArticle({ ...article, title: e.target.value })}
                  placeholder="Enter article title"
                />
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea
                  value={article.summary}
                  onChange={(e) => setArticle({ ...article, summary: e.target.value })}
                  placeholder="Brief description for search results"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Content *</Label>
                <Textarea
                  value={article.content}
                  onChange={(e) => setArticle({ ...article, content: e.target.value })}
                  placeholder="Write your article content here. Markdown is supported."
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Attachments</span>
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild disabled={uploading}>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? 'Uploading...' : 'Upload File'}
                      </span>
                    </Button>
                  </Label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No attachments yet. Upload PDFs or images (max 10MB).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {attachment.file_type.startsWith('image/') ? (
                            <Image className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                          ) : (
                            <FileText className="h-8 w-8 text-red-500 dark:text-red-400" />
                          )}
                          <div>
                            <a
                              href={attachment.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium hover:underline"
                            >
                              {attachment.file_name}
                            </a>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.file_size)} •{' '}
                              {format(new Date(attachment.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAttachment(attachment)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Linked Issues */}
          {!isNew && linkedIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Linked Issues ({linkedIssues.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {linkedIssues.map((li) => (
                    <div key={li.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/issues/${li.issue_id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {li.issue_title}
                          </Link>
                          <Badge variant="outline" className="text-xs">
                            {LINK_TYPES.find((lt) => lt.value === li.link_type)?.label || li.link_type}
                          </Badge>
                        </div>
                        {li.stage_notes && (
                          <p className="text-xs text-muted-foreground mt-1">{li.stage_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {li.helped_resolve === true && (
                          <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                        )}
                        {li.helped_resolve === false && (
                          <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(li.applied_at), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={article.status}
                  onValueChange={(v) => setArticle({ ...article, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={article.category || '__none__'}
                  onValueChange={(v) => setArticle({ ...article, category: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a tag"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <Button size="icon" onClick={handleAddTag}>
                  +
                </Button>
              </div>
              {article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="pl-2 pr-1">
                      {tag}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Views</span>
                  <span className="font-medium">{article.view_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Issues</span>
                  <span className="font-medium">{linkedIssues.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Helped Resolve</span>
                  <span className="font-medium">
                    {linkedIssues.filter((li) => li.helped_resolve === true).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attachments</span>
                  <span className="font-medium">{attachments.length}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
