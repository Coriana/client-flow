import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, X, Briefcase, Package, Box, BookOpen, Bookmark, Link2, ExternalLink, Copy } from 'lucide-react';
import { useState } from 'react';

interface LinkedJob {
  id: string;
  job_id: string;
  job_number: string;
  name: string;
}

interface LinkedAsset {
  id: string;
  asset_id: string;
  asset_tag: string;
  name: string;
}

interface LinkedItem {
  id: string;
  item_id: string;
  sku: string;
  name: string;
}

interface LinkedArticle {
  id: string;
  article_id: string;
  link_type: string;
  article_title: string;
  article_category: string | null;
}

interface IssueBookmark {
  id: string;
  issue_id: string;
  bookmark_label: string;
  content: string;
  created_at: string;
  issue_title?: string;
}

interface LinkedBookmark {
  id: string;
  target_bookmark_id: string;
  bookmark: IssueBookmark;
}

interface LinkedEntitiesCardProps {
  linkedJobs: LinkedJob[];
  linkedAssets: LinkedAsset[];
  linkedItems: LinkedItem[];
  linkedArticles: LinkedArticle[];
  bookmarks: IssueBookmark[];
  linkedBookmarks: LinkedBookmark[];
  onRemoveJob: (jobId: string) => void;
  onRemoveAsset: (assetId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveArticle: (linkId: string) => void;
  onDeleteBookmark: (id: string, label: string) => void;
  onUnlinkBookmark: (linkId: string, label: string) => void;
  onCopyBookmarkLink: (bookmark: IssueBookmark) => void;
}

function EntitySection({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {count}
          </Badge>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function LinkedEntitiesCard({
  linkedJobs,
  linkedAssets,
  linkedItems,
  linkedArticles,
  bookmarks,
  linkedBookmarks,
  onRemoveJob,
  onRemoveAsset,
  onRemoveItem,
  onRemoveArticle,
  onDeleteBookmark,
  onUnlinkBookmark,
  onCopyBookmarkLink,
}: LinkedEntitiesCardProps) {
  const totalCount = 
    linkedJobs.length + 
    linkedAssets.length + 
    linkedItems.length + 
    linkedArticles.length + 
    bookmarks.length + 
    linkedBookmarks.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Linked Entities
          {totalCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {totalCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Jobs */}
        <EntitySection title="Jobs" icon={Briefcase} count={linkedJobs.length}>
          {linkedJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6">No jobs linked</p>
          ) : (
            linkedJobs.map((lj) => (
              <div key={lj.job_id} className="flex items-center justify-between py-1 pl-6 pr-1 hover:bg-muted/30 rounded">
                <Link to={`/jobs/${lj.job_id}`} className="text-xs hover:underline truncate flex-1">
                  {lj.job_number} - {lj.name}
                </Link>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRemoveJob(lj.job_id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </EntitySection>

        {/* Assets */}
        <EntitySection title="Assets" icon={Package} count={linkedAssets.length}>
          {linkedAssets.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6">No assets linked</p>
          ) : (
            linkedAssets.map((la) => (
              <div key={la.asset_id} className="flex items-center justify-between py-1 pl-6 pr-1 hover:bg-muted/30 rounded">
                <Link to={`/assets/${la.asset_id}`} className="text-xs hover:underline truncate flex-1">
                  {la.asset_tag} - {la.name}
                </Link>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRemoveAsset(la.asset_id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </EntitySection>

        {/* Items */}
        <EntitySection title="Inventory" icon={Box} count={linkedItems.length}>
          {linkedItems.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6">No items linked</p>
          ) : (
            linkedItems.map((li) => (
              <div key={li.item_id} className="flex items-center justify-between py-1 pl-6 pr-1 hover:bg-muted/30 rounded">
                <Link to={`/inventory/${li.item_id}`} className="text-xs hover:underline truncate flex-1">
                  {li.sku} - {li.name}
                </Link>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRemoveItem(li.item_id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </EntitySection>

        {/* KB Articles */}
        <EntitySection title="KB Articles" icon={BookOpen} count={linkedArticles.length}>
          {linkedArticles.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6">No articles linked</p>
          ) : (
            linkedArticles.map((la) => (
              <div key={la.id} className="flex items-center justify-between py-1 pl-6 pr-1 hover:bg-muted/30 rounded">
                <div className="flex items-center gap-1 truncate flex-1">
                  <Link to={`/knowledge-base/${la.article_id}`} className="text-xs hover:underline truncate">
                    {la.article_title}
                  </Link>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{la.link_type}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRemoveArticle(la.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </EntitySection>

        {/* Bookmarks (Own) */}
        <EntitySection title="Bookmarks" icon={Bookmark} count={bookmarks.length}>
          {bookmarks.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6">No bookmarks created</p>
          ) : (
            bookmarks.map((b) => (
              <div key={b.id} id={`bookmark-${b.id}`} className="py-1 pl-6 pr-1 hover:bg-muted/30 rounded space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{b.bookmark_label}</span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onCopyBookmarkLink(b)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onDeleteBookmark(b.id, b.bookmark_label)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{b.content}</p>
              </div>
            ))
          )}
        </EntitySection>

        {/* Linked Resolutions */}
        <EntitySection title="Linked Resolutions" icon={Link2} count={linkedBookmarks.length} defaultOpen={linkedBookmarks.length > 0}>
          {linkedBookmarks.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6">No linked resolutions</p>
          ) : (
            linkedBookmarks.map((lb) => (
              <div key={lb.id} className="py-1 pl-6 pr-1 hover:bg-muted/30 rounded space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{lb.bookmark.bookmark_label}</span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" asChild>
                      <Link to={`/issues/${lb.bookmark.issue_id}#bookmark-${lb.bookmark.id}`}>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onUnlinkBookmark(lb.id, lb.bookmark.bookmark_label)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{lb.bookmark.content}</p>
                <p className="text-[10px] text-muted-foreground">From: {lb.bookmark.issue_title}</p>
              </div>
            ))
          )}
        </EntitySection>
      </CardContent>
    </Card>
  );
}
