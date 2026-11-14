import { ArrowRight, Link2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnswerSpecMatching, MatchingPair } from '../../types';

interface MatchingEditorProps {
  spec: AnswerSpecMatching;
  onChange: (next: AnswerSpecMatching) => void;
  disabled?: boolean;
}

export function MatchingEditor({
  spec,
  onChange,
  disabled = false,
}: MatchingEditorProps) {
  // Left items handlers
  const handleAddLeftItem = () => {
    let nextId = `l${spec.left_items.length + 1}`;
    while (spec.left_items.some((it) => it.id === nextId)) {
      nextId = `l${Math.floor(Math.random() * 1000)}`;
    }
    const nextLeft = [...spec.left_items, { id: nextId, label: '' }];
    onChange({ ...spec, left_items: nextLeft });
  };

  const handleUpdateLeftItem = (index: number, label: string) => {
    const nextLeft = [...spec.left_items];
    nextLeft[index] = { ...nextLeft[index], label };
    onChange({ ...spec, left_items: nextLeft });
  };

  const handleRemoveLeftItem = (index: number) => {
    if (spec.left_items.length <= 1) return;
    const target = spec.left_items[index];
    const nextLeft = spec.left_items.filter((_, i) => i !== index);
    // Remove pairs referencing this left item
    const nextPairs = spec.pairs.filter((p) => p.left_id !== target.id);
    onChange({ ...spec, left_items: nextLeft, pairs: nextPairs });
  };

  // Right items handlers
  const handleAddRightItem = () => {
    let nextId = `r${spec.right_items.length + 1}`;
    while (spec.right_items.some((it) => it.id === nextId)) {
      nextId = `r${Math.floor(Math.random() * 1000)}`;
    }
    const nextRight = [...spec.right_items, { id: nextId, label: '' }];
    onChange({ ...spec, right_items: nextRight });
  };

  const handleUpdateRightItem = (index: number, label: string) => {
    const nextRight = [...spec.right_items];
    nextRight[index] = { ...nextRight[index], label };
    onChange({ ...spec, right_items: nextRight });
  };

  const handleRemoveRightItem = (index: number) => {
    if (spec.right_items.length <= 1) return;
    const target = spec.right_items[index];
    const nextRight = spec.right_items.filter((_, i) => i !== index);
    // Remove pairs referencing this right item
    const nextPairs = spec.pairs.filter((p) => p.right_id !== target.id);
    onChange({ ...spec, right_items: nextRight, pairs: nextPairs });
  };

  // Pairs handlers
  const handleAddPair = () => {
    // Find first available unpaired left & right items
    const pairedLeft = new Set(spec.pairs.map((p) => p.left_id));
    const pairedRight = new Set(spec.pairs.map((p) => p.right_id));

    const availableLeft = spec.left_items.find((it) => !pairedLeft.has(it.id));
    const availableRight = spec.right_items.find((it) => !pairedRight.has(it.id));

    const leftId = availableLeft ? availableLeft.id : spec.left_items[0]?.id;
    const rightId = availableRight ? availableRight.id : spec.right_items[0]?.id;

    if (!leftId || !rightId) return;

    const newPair: MatchingPair = { left_id: leftId, right_id: rightId };
    onChange({ ...spec, pairs: [...spec.pairs, newPair] });
  };

  const handleUpdatePair = (
    index: number,
    field: 'left_id' | 'right_id',
    value: string
  ) => {
    const nextPairs = [...spec.pairs];
    nextPairs[index] = {
      ...nextPairs[index],
      [field]: value,
    };
    onChange({ ...spec, pairs: nextPairs });
  };

  const handleRemovePair = (index: number) => {
    if (spec.pairs.length <= 1) return;
    const nextPairs = spec.pairs.filter((_, i) => i !== index);
    onChange({ ...spec, pairs: nextPairs });
  };

  return (
    <div className="space-y-5">
      {/* 2 Columns: Left items & Right items */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left items */}
        <div className="space-y-2.5 rounded-md border border-surface-border bg-surface-card p-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-surface-border pb-2">
            <span className="text-xs font-bold text-text-primary">
              Cột A (Vế trái - {spec.left_items.length} mục)
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddLeftItem}
              disabled={disabled}
              className="h-6 gap-1 px-1.5 text-[11px] font-semibold"
            >
              <Plus aria-hidden="true" className="size-2.5" />
              <span>Thêm vế trái</span>
            </Button>
          </div>

          <div className="space-y-2">
            {spec.left_items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <span className="w-8 shrink-0 font-mono text-[11px] font-bold text-brand-600">
                  A{index + 1}:
                </span>
                <Input
                  value={item.label}
                  onChange={(e) => handleUpdateLeftItem(index, e.target.value)}
                  disabled={disabled}
                  placeholder={`Nội dung mục A${index + 1}...`}
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveLeftItem(index)}
                  disabled={disabled || spec.left_items.length <= 1}
                  className="size-7 text-semantic-error disabled:opacity-30"
                >
                  <Trash2 aria-hidden="true" className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Right items */}
        <div className="space-y-2.5 rounded-md border border-surface-border bg-surface-card p-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-surface-border pb-2">
            <span className="text-xs font-bold text-text-primary">
              Cột B (Vế phải - {spec.right_items.length} mục)
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddRightItem}
              disabled={disabled}
              className="h-6 gap-1 px-1.5 text-[11px] font-semibold"
            >
              <Plus aria-hidden="true" className="size-2.5" />
              <span>Thêm vế phải</span>
            </Button>
          </div>

          <div className="space-y-2">
            {spec.right_items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <span className="w-8 shrink-0 font-mono text-[11px] font-bold text-semantic-info">
                  B{index + 1}:
                </span>
                <Input
                  value={item.label}
                  onChange={(e) => handleUpdateRightItem(index, e.target.value)}
                  disabled={disabled}
                  placeholder={`Nội dung mục B${index + 1}...`}
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveRightItem(index)}
                  disabled={disabled || spec.right_items.length <= 1}
                  className="size-7 text-semantic-error disabled:opacity-30"
                >
                  <Trash2 aria-hidden="true" className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Matching Pairs (Answer Key) */}
      <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted/30 p-3.5 shadow-sm">
        <div className="flex items-center justify-between border-b border-surface-border pb-2">
          <div className="flex items-center gap-1.5">
            <Link2 aria-hidden="true" className="size-4 text-brand-600" />
            <span className="text-xs font-bold text-text-primary">
              Quy tắc ghép cặp đúng (Đáp án chuẩn)
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddPair}
            disabled={disabled}
            className="h-7 gap-1 px-2 text-xs font-semibold"
          >
            <Plus aria-hidden="true" className="size-3" />
            <span>Thêm cặp ghép</span>
          </Button>
        </div>

        <div className="space-y-2">
          {spec.pairs.map((pair, index) => {
            return (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-md border border-surface-border bg-surface-card p-2 text-xs"
              >
                <span className="w-12 font-bold text-text-secondary">
                  Cặp #{index + 1}:
                </span>

                {/* Left Selector */}
                <div className="min-w-[140px] flex-1">
                  <Select
                    value={pair.left_id}
                    onValueChange={(val) =>
                      handleUpdatePair(index, 'left_id', val)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Chọn vế trái" />
                    </SelectTrigger>
                    <SelectContent>
                      {spec.left_items.map((it, i) => (
                        <SelectItem key={it.id} value={it.id}>
                          A{i + 1}: {it.label || '(chưa có nhãn)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-text-secondary"
                />

                {/* Right Selector */}
                <div className="min-w-[140px] flex-1">
                  <Select
                    value={pair.right_id}
                    onValueChange={(val) =>
                      handleUpdatePair(index, 'right_id', val)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Chọn vế phải" />
                    </SelectTrigger>
                    <SelectContent>
                      {spec.right_items.map((it, i) => (
                        <SelectItem key={it.id} value={it.id}>
                          B{i + 1}: {it.label || '(chưa có nhãn)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePair(index)}
                  disabled={disabled || spec.pairs.length <= 1}
                  className="size-7 text-semantic-error disabled:opacity-30"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
