import { format } from 'date-fns';
import { Clock, MessageSquare, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  user_name?: string;
}

interface IssueActivityFeedProps {
  comments: Comment[];
}

export default function IssueActivityFeed({ comments }: IssueActivityFeedProps) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
        <p className="text-xs">Add a note to start the conversation</p>
      </div>
    );
  }

  // Detect if a comment is a system log (contains keywords like "changed", "Added", "Removed", "linked")
  const isSystemLog = (content: string) => {
    const systemPatterns = [
      /^(Title|Description|Severity|Status|Due date) changed/,
      /^(Added|Removed) (job|asset|item|bookmark):/,
      /^(Created|Removed) bookmark:/,
      /^(Linked|Unlinked) (to )?resolution:/,
    ];
    return systemPatterns.some(pattern => pattern.test(content));
  };

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-3">
        {comments.map((comment) => {
          const isSystem = isSystemLog(comment.content);
          
          return (
            <div 
              key={comment.id} 
              className={`rounded-lg p-3 space-y-1.5 ${
                isSystem 
                  ? 'bg-muted/30 border border-dashed border-border' 
                  : 'bg-card border border-border'
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isSystem ? (
                  <Clock className="h-3 w-3" />
                ) : (
                  <User className="h-3 w-3" />
                )}
                <span className="font-medium">{comment.user_name || 'System'}</span>
                <span>•</span>
                <span>{format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
              <div className={`text-sm whitespace-pre-line ${isSystem ? 'text-muted-foreground' : ''}`}>
                {comment.content}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
