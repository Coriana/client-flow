import { useMemo } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

interface ActivityDetailsProps {
  action: string;
  oldValues: unknown;
  newValues: unknown;
}

// Fields to exclude from diff display
const EXCLUDED_FIELDS = [
  "id", "user_id", "created_at", "updated_at", "created_by", 
  "updated_by", "deleted_at", "password", "key_hash"
];

// Fields to format specially. `formatCurrency` is passed in from the caller
// (BrandingContext) since this is a plain function, not a hook.
const formatValue = (key: string, value: unknown, formatCurrency: (amount: number) => string): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.join(", ") || "—";
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    // Format currency-like fields
    if (key.includes("amount") || key.includes("price") || key.includes("cost") ||
        key.includes("rate") || key.includes("total") || key.includes("balance")) {
      return formatCurrency(value);
    }
    return value.toString();
  }
  // Truncate long strings
  const str = String(value);
  return str.length > 100 ? str.substring(0, 100) + "..." : str;
};

const formatFieldName = (key: string): string => {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

export default function ActivityDetails({ action, oldValues, newValues }: ActivityDetailsProps) {
  const { formatCurrency } = useBranding();
  const changes = useMemo(() => {
    const oldObj = (typeof oldValues === 'object' && oldValues !== null) ? oldValues as Record<string, unknown> : null;
    const newObj = (typeof newValues === 'object' && newValues !== null) ? newValues as Record<string, unknown> : null;

    if (action === "created" && newObj) {
      // For creates, show non-null new values
      return Object.entries(newObj)
        .filter(([key, value]) => !EXCLUDED_FIELDS.includes(key) && value !== null)
        .map(([key, value]) => ({
          field: key,
          type: "added" as const,
          newValue: value,
        }));
    }
    
    if (action === "deleted" && oldObj) {
      // For deletes, show what was deleted
      return Object.entries(oldObj)
        .filter(([key, value]) => !EXCLUDED_FIELDS.includes(key) && value !== null)
        .map(([key, value]) => ({
          field: key,
          type: "removed" as const,
          oldValue: value,
        }));
    }
    
    if (action === "updated" && oldObj && newObj) {
      // For updates, show changed fields
      const changedFields: { field: string; type: "changed"; oldValue: unknown; newValue: unknown }[] = [];
      
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
      
      allKeys.forEach(key => {
        if (EXCLUDED_FIELDS.includes(key)) return;
        
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        
        // Skip if values are the same
        if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return;
        
        changedFields.push({
          field: key,
          type: "changed",
          oldValue: oldVal,
          newValue: newVal,
        });
      });
      
      return changedFields;
    }
    
    return [];
  }, [action, oldValues, newValues]);

  if (changes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No details available</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {action === "created" ? "Values" : action === "deleted" ? "Deleted Values" : "Changes"}
      </p>
      <div className="space-y-1.5">
        {changes.slice(0, 10).map((change) => (
          <div key={change.field} className="flex items-start gap-2 text-sm">
            {change.type === "added" && (
              <>
                <Plus className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="font-medium text-muted-foreground min-w-[120px]">
                  {formatFieldName(change.field)}:
                </span>
                <span className="text-foreground">
                  {formatValue(change.field, change.newValue, formatCurrency)}
                </span>
              </>
            )}
            {change.type === "removed" && (
              <>
                <Minus className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="font-medium text-muted-foreground min-w-[120px]">
                  {formatFieldName(change.field)}:
                </span>
                <span className="text-muted-foreground line-through">
                  {formatValue(change.field, change.oldValue, formatCurrency)}
                </span>
              </>
            )}
            {change.type === "changed" && (
              <>
                <ArrowRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span className="font-medium text-muted-foreground min-w-[120px]">
                  {formatFieldName(change.field)}:
                </span>
                <span className="text-muted-foreground line-through">
                  {formatValue(change.field, change.oldValue, formatCurrency)}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">
                  {formatValue(change.field, change.newValue, formatCurrency)}
                </span>
              </>
            )}
          </div>
        ))}
        {changes.length > 10 && (
          <p className="text-xs text-muted-foreground mt-2">
            + {changes.length - 10} more changes
          </p>
        )}
      </div>
    </div>
  );
}
