import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { animated, useSpring } from '@react-spring/web';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileSpreadsheet,
  Flag,
  FolderTree,
  GripVertical,
  MoreHorizontal,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { ExpandingIconTabs } from '@/components/microkit/expanding-icon-tabs';
import { HoldToDeleteButton } from '@/components/microkit/hold-to-delete-button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RootQuestionItem {
  id: string;
  code: string;
  title: string;
  type: string;
  points: string;
}

const INITIAL_ROOT_QUESTIONS: RootQuestionItem[] = [
  {
    id: 'q1',
    code: 'Q101',
    title: 'Tính giới hạn lim(x→0) sin(3x)/x',
    type: 'SINGLE_CHOICE',
    points: '2.5đ',
  },
  {
    id: 'q2',
    code: 'Q104',
    title: 'Điều kiện khả vi của hàm số tại x₀',
    type: 'MULTI_CHOICE',
    points: '2.5đ',
  },
  {
    id: 'q3',
    code: 'Q109',
    title: 'Ghép cặp hàm số và đạo hàm tương ứng',
    type: 'MATCHING',
    points: '5.0đ',
  },
];

function SortableRootRow({
  item,
  index,
  total,
  onMove,
}: {
  item: RootQuestionItem;
  index: number;
  total: number;
  onMove: (index: number, delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const springStyle = useSpring({
    scale: isDragging ? 1.01 : 1,
    config: { tension: 320, friction: 26 },
  });

  return (
    <animated.div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        scale: springStyle.scale,
      }}
      className="flex items-center justify-between gap-2 rounded-lg border border-surface-border bg-surface-card p-2.5 text-xs shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-text-secondary hover:bg-surface-muted active:cursor-grabbing"
          aria-label={`Kéo sắp xếp ${item.code}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Badge variant="outline" className="font-mono">
          #{index + 1}
        </Badge>
        <span className="font-mono text-text-secondary">{item.code}</span>
        <span className="truncate font-medium text-text-primary">{item.title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant="secondary" className="font-mono">
          {item.points}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label={`Đưa ${item.code} lên`}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label={`Đưa ${item.code} xuống`}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </animated.div>
  );
}

export function OlmsUiShowcasePage() {
  // Module A state
  const [copiedUser, setCopiedUser] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [techOpen, setTechOpen] = useState(false);

  // Module B state
  const [treeOpen, setTreeOpen] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState('l_hospital');

  // Module C state
  const [examStep, setExamStep] = useState(2);
  const [genMode, setGenMode] = useState<'FROM_ROOT' | 'FROM_MATRIX'>('FROM_ROOT');
  const [rootItems, setRootItems] = useState<RootQuestionItem[]>(INITIAL_ROOT_QUESTIONS);
  const [excelFile, setExcelFile] = useState<string>('danh_sach_thi_IT1110.xlsx');
  const [commitDone, setCommitDone] = useState(false);

  // Module D state
  const [casState, setCasState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [timerMode, setTimerMode] = useState<'normal' | 'warning' | 'critical'>('normal');
  const [selectedSingle, setSelectedSingle] = useState('B');
  const [selectedMulti, setSelectedMulti] = useState<string[]>(['A', 'B']);
  const [flaggedQ3, setFlaggedQ3] = useState(true);
  const [submittedMsg, setSubmittedMsg] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRootItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMoveKeyboard = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rootItems.length) return;
    setRootItems((items) => arrayMove(items, index, target));
  };

  const triggerCopy = () => {
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 1500);
  };

  const triggerCasSave = () => {
    setCasState('saving');
    setTimeout(() => setCasState('saved'), 220);
  };

  const toggleMulti = (key: string) => {
    setSelectedMulti((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
    triggerCasSave();
  };

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-surface-border bg-surface-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 font-mono text-xs font-bold text-white">
              OLMS
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-text-primary">
                OLMS UI Component Showcase (Cài đặt thật trong <code className="font-mono">frontend/</code>)
              </h1>
              <p className="text-xs text-text-secondary">
                shadcn/ui + Radix Primitives + 21st.dev Patterns + MicroKit UI + Kinetics (@react-spring/web &amp; @dnd-kit)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              78 APIs · tokens.css
            </Badge>
            <ThemeToggle showLabel />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 pt-8">
        {/* ============================================================
            PHÂN HỆ A: QUẢN TRỊ & HỆ THỐNG
           ============================================================ */}
        <Card>
          <CardHeader className="border-b border-surface-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">
                  Phân hệ A — Quản trị &amp; Hệ thống (<code className="font-mono text-sm">auth</code>, <code className="font-mono text-sm">users</code>, <code className="font-mono text-sm">audit-logs</code>)
                </CardTitle>
                <CardDescription>
                  shadcn/ui Table, DropdownMenu, Dialog 2 cột, AlertDialog, Collapsible + Component Gallery Audit Filter + MicroKit UI
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSkeleton(true);
                    setTimeout(() => setShowSkeleton(false), 700);
                  }}
                >
                  Thử Skeleton bảng
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">+ Tạo tài khoản (Dialog 2 cột)</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Tạo tài khoản mới (shadcn Dialog max-w-2xl)</DialogTitle>
                      <DialogDescription>
                        Bố cục 2 cột giúp hiển thị đầy đủ trường nhập liệu mà không sinh thanh cuộn dọc.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold">Tên đăng nhập *</label>
                        <Input placeholder="vd: gv_nguyen_van_a" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold">Vai trò *</label>
                        <Select defaultValue="TEACHER">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Quản trị viên (ADMIN)</SelectItem>
                            <SelectItem value="TEACHER">Giảng viên (TEACHER)</SelectItem>
                            <SelectItem value="STUDENT">Thí sinh (STUDENT)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold">Họ và tên *</label>
                        <Input placeholder="ThS. Nguyễn Minh Quân" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold">Email liên hệ</label>
                        <Input type="email" placeholder="quan.nm@olms.edu.vn" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button">Lưu tài khoản</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* Audit Log Multi-Criteria Filter Bar */}
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-surface-border bg-surface-muted p-3 sm:grid-cols-4">
              <div>
                <div className="mb-1 text-xs font-medium text-text-secondary">Khoảng thời gian</div>
                <Input readOnly value="2026-11-01 → 2026-11-14" className="h-8 bg-surface-card font-mono text-xs" />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-text-secondary">action_type</div>
                <Select defaultValue="ALL">
                  <SelectTrigger className="h-8 bg-surface-card text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả hành động</SelectItem>
                    <SelectItem value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</SelectItem>
                    <SelectItem value="EXAM_PUBLISH">EXAM_PUBLISH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-text-secondary">entity_type</div>
                <Select defaultValue="USERS">
                  <SelectTrigger className="h-8 bg-surface-card text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USERS">USERS</SelectItem>
                    <SelectItem value="EXAMS">EXAMS</SelectItem>
                    <SelectItem value="SUBMISSIONS">SUBMISSIONS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-text-secondary">actor_id</div>
                <Input readOnly value="@admin (#1)" className="h-8 bg-surface-card font-mono text-xs" />
              </div>
            </div>

            {/* shadcn Table */}
            <div className="rounded-lg border border-surface-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tài khoản</TableHead>
                    <TableHead>Họ tên &amp; Liên hệ</TableHead>
                    <TableHead>Vai trò &amp; Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showSkeleton ? (
                    <TableRow>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-7 w-24" /></TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="max-w-[150px] truncate font-mono text-xs font-semibold">
                            @gv_nguyen_minh_quan_2026
                          </span>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={triggerCopy}>
                            {copiedUser ? (
                              <span className="inline-flex items-center gap-1 text-semantic-success">
                                <Check className="h-3.5 w-3.5" /> Đã sao chép
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Copy className="h-3.5 w-3.5" /> Sao chép
                              </span>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">ThS. Nguyễn Minh Quân</div>
                        <div className="text-xs text-text-secondary">quan.nm@olms.edu.vn · 0903 112 489</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary">TEACHER</Badge>
                          <Badge className="bg-semantic-success-bg text-semantic-success hover:bg-semantic-success-bg">
                            ACTIVE
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <AlertDialog>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                                  Thao tác <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Xem chi tiết</DropdownMenuItem>
                                <DropdownMenuItem>Chỉnh sửa thông tin</DropdownMenuItem>
                                <DropdownMenuItem>Đặt lại mật khẩu</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-semantic-error focus:text-semantic-error">
                                    Khóa / Xóa mềm tài khoản
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận khóa tài khoản?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tài khoản @gv_nguyen_minh_quan_2026 sẽ bị vô hiệu hóa phiên đăng nhập hiện tại.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction>Xác nhận khóa</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* MicroKit UI Installed Components + Collapsible Technical Details */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-muted p-3">
                <div className="text-xs">
                  <div className="font-semibold">MicroKit UI (cài thật từ <code className="font-mono">@microkit/*</code>)</div>
                  <div className="text-text-secondary">ExpandingIconTabs + HoldToDeleteButton</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExpandingIconTabs />
                  <HoldToDeleteButton />
                </div>
              </div>

              <Collapsible open={techOpen} onOpenChange={setTechOpen} className="rounded-lg border border-surface-border bg-surface-muted p-3">
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex w-full items-center justify-between text-xs font-semibold">
                    <span>Chi tiết kỹ thuật (shadcn Collapsible)</span>
                    {techOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 border-t border-surface-border pt-2 font-mono text-xs text-text-secondary">
                  code: USER_LOCKED · trace_id: req_7f91a04c
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>

        {/* ============================================================
            PHÂN HỆ B: CÂY KIẾN THỨC & 5 DẠNG CÂU HỎI
           ============================================================ */}
        <Card>
          <CardHeader className="border-b border-surface-border pb-4">
            <CardTitle className="text-lg">
              Phân hệ B — Cây kiến thức 4 cấp &amp; Trình biên tập 5 dạng câu hỏi
            </CardTitle>
            <CardDescription>
              Master-Detail 4/8 cột · TreeView active/total · Tabs 5 dạng câu hỏi · Split Editor + Live Preview
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* 4 cols TreeView */}
              <div className="space-y-3 rounded-lg border border-surface-border bg-surface-muted p-4 lg:col-span-4">
                <div className="flex items-center justify-between border-b border-surface-border pb-2 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <FolderTree className="h-4 w-4 text-brand-600" /> Cây kiến thức
                  </span>
                  <span className="font-mono text-text-secondary">active / total</span>
                </div>

                <Collapsible open={treeOpen} onOpenChange={setTreeOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between py-1 text-xs font-bold">
                      <span>{treeOpen ? '▾' : '▸'} Môn: Giải tích 1 (IT1110)</span>
                      <Badge variant="outline" className="font-mono">138 / 142</Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 border-l border-surface-border pl-3 pt-1 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span>▾ Chương 1: Giới hạn</span>
                      <span className="font-mono text-text-secondary">62 / 64</span>
                    </div>
                    <div className="space-y-1 border-l border-surface-border pl-3">
                      <button
                        type="button"
                        onClick={() => setSelectedTopic('l_hospital')}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors ${
                          selectedTopic === 'l_hospital'
                            ? 'bg-brand-600 font-semibold text-white'
                            : 'bg-surface-card text-text-primary hover:bg-semantic-info-bg hover:text-brand-700 dark:hover:text-brand-200'
                        }`}
                      >
                        <span>• topic_tag: l_hospital</span>
                        <span className="font-mono">15 / 16</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTopic('vo_cung_be')}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors ${
                          selectedTopic === 'vo_cung_be'
                            ? 'bg-brand-600 font-semibold text-white'
                            : 'bg-surface-card text-text-primary hover:bg-semantic-info-bg hover:text-brand-700 dark:hover:text-brand-200'
                        }`}
                      >
                        <span>• topic_tag: vo_cung_be</span>
                        <span className="font-mono">12 / 12</span>
                      </button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="grid grid-cols-3 gap-1.5 pt-2 text-center text-xs">
                  <div className="rounded border border-surface-border p-1.5" style={{ background: 'var(--olms-diff-easy-bg)', color: 'var(--olms-diff-easy)' }}>
                    <div className="font-bold">EASY</div>
                    <div className="font-mono">6</div>
                  </div>
                  <div className="rounded border border-surface-border p-1.5" style={{ background: 'var(--olms-diff-medium-bg)', color: 'var(--olms-diff-medium)' }}>
                    <div className="font-bold">MEDIUM</div>
                    <div className="font-mono">7</div>
                  </div>
                  <div className="rounded border border-surface-border p-1.5" style={{ background: 'var(--olms-diff-hard-bg)', color: 'var(--olms-diff-hard)' }}>
                    <div className="font-bold">HARD</div>
                    <div className="font-mono">3</div>
                  </div>
                </div>
              </div>

              {/* 8 cols 5 Question Type Tabs */}
              <div className="lg:col-span-8">
                <Tabs defaultValue="SINGLE_CHOICE">
                  <TabsList className="flex h-auto flex-wrap justify-start gap-1">
                    <TabsTrigger value="SINGLE_CHOICE">SINGLE_CHOICE</TabsTrigger>
                    <TabsTrigger value="MULTI_CHOICE">MULTI_CHOICE</TabsTrigger>
                    <TabsTrigger value="DROPDOWN">DROPDOWN</TabsTrigger>
                    <TabsTrigger value="INPUT">INPUT</TabsTrigger>
                    <TabsTrigger value="MATCHING">MATCHING</TabsTrigger>
                  </TabsList>

                  <TabsContent value="SINGLE_CHOICE" className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-2">
                    <div className="space-y-2 rounded-lg border border-surface-border bg-surface-muted p-3 text-xs">
                      <div className="font-bold">Cấu hình <code className="font-mono">answer_spec</code></div>
                      <Input defaultValue="Tính giới hạn lim(x→0) sin(3x)/x" className="bg-surface-card text-xs" />
                      <div className="rounded border border-dashed border-surface-border bg-surface-card p-2 font-mono text-xs text-text-secondary">
                        media_url: /uploads/q_graph_01.png
                      </div>
                    </div>
                    <div className="space-y-2 rounded-lg border border-brand-200 bg-surface-card p-3 text-xs">
                      <div className="font-bold text-brand-700">Live Preview (RadioGroup)</div>
                      <RadioGroup defaultValue="B" className="grid grid-cols-2 gap-2">
                        {['A. 0', 'B. 3', 'C. 1/3', 'D. ∞'].map((opt) => {
                          const key = opt[0];
                          return (
                            <label key={key} className="flex cursor-pointer items-center gap-2 rounded border border-surface-border p-2">
                              <RadioGroupItem value={key} />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  </TabsContent>

                  <TabsContent value="MULTI_CHOICE" className="rounded-lg border border-surface-border p-3 text-xs">
                    <div className="mb-2 font-semibold">CheckboxCard (tối thiểu 2 đáp án đúng):</div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 rounded border border-surface-border p-2"><Checkbox defaultChecked /> A. Liên tục tại x₀</label>
                      <label className="flex items-center gap-2 rounded border border-surface-border p-2"><Checkbox defaultChecked /> B. Có đạo hàm hữu hạn</label>
                    </div>
                  </TabsContent>

                  <TabsContent value="DROPDOWN" className="rounded-lg border border-surface-border p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Nếu hàm khả vi tại x₀ thì hàm</span>
                      <Select defaultValue="lien-tuc">
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lien-tuc">liên tục tại x₀ (blank_1)</SelectItem>
                          <SelectItem value="gian-doan">gián đoạn tại x₀</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="INPUT" className="rounded-lg border border-surface-border p-3 text-xs">
                    <div className="space-y-2">
                      <div className="font-semibold">Danh sách đáp án chấp nhận (<code className="font-mono">accepted_answers</code>):</div>
                      <Input defaultValue="6, 6.0" className="max-w-xs font-mono" />
                    </div>
                  </TabsContent>

                  <TabsContent value="MATCHING" className="rounded-lg border border-surface-border p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border border-brand-600 bg-semantic-info-bg p-2 font-semibold text-brand-700 dark:text-brand-200">Vế A1: (sin x)&apos; ───►</div>
                      <div className="rounded border border-brand-600 bg-semantic-info-bg p-2 font-bold text-brand-700 dark:text-brand-200">Vế B1: cos x</div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================================
            PHÂN HỆ C: KỲ THI, ĐỀ GỐC ROOT & IMPORT EXCEL
           ============================================================ */}
        <Card>
          <CardHeader className="border-b border-surface-border pb-4">
            <CardTitle className="text-lg">
              Phân hệ C — Workspace Kỳ thi 5 bước, Sắp xếp Đề gốc <code className="font-mono text-sm">ROOT</code> &amp; Import Excel 2 bước
            </CardTitle>
            <CardDescription>
              Stepper 21st.dev · Kéo-thả @dnd-kit + @react-spring/web (Kinetics) kèm nút ↑/↓ bàn phím · Excel Preview (TTL 15p) → Commit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {/* 5-step stepper */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                '1. Thông tin chung',
                '2. Cấu hình đề',
                '3. Mã đề (ROOT, 101...)',
                '4. Thí sinh (Excel)',
                '5. Kết quả & Phổ điểm',
              ].map((label, idx) => {
                const step = idx + 1;
                const active = examStep === step;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setExamStep(step)}
                    className={`rounded-lg border p-2.5 text-left text-xs transition-colors ${
                      active
                        ? 'border-brand-600 bg-semantic-info-bg font-bold text-text-primary'
                        : 'border-surface-border bg-surface-muted text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Kinetics + dnd-kit ROOT Reorder */}
              <div className="space-y-3 rounded-lg border border-surface-border bg-surface-muted p-4 lg:col-span-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold">
                    Đề gốc <code className="font-mono">FROM_ROOT</code> (Kéo-thả hoặc ↑/↓)
                  </span>
                  <div className="inline-flex rounded-md border border-surface-border bg-surface-card p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setGenMode('FROM_ROOT')}
                      className={`rounded px-2 py-0.5 font-semibold ${
                        genMode === 'FROM_ROOT' ? 'bg-brand-600 text-white' : 'text-text-secondary'
                      }`}
                    >
                      FROM_ROOT
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenMode('FROM_MATRIX')}
                      className={`rounded px-2 py-0.5 font-semibold ${
                        genMode === 'FROM_MATRIX' ? 'bg-brand-600 text-white' : 'text-text-secondary'
                      }`}
                    >
                      FROM_MATRIX
                    </button>
                  </div>
                </div>

                {genMode === 'FROM_ROOT' ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={rootItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {rootItems.map((item, idx) => (
                          <SortableRootRow
                            key={item.id}
                            item={item}
                            index={idx}
                            total={rootItems.length}
                            onMove={handleMoveKeyboard}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="space-y-2 rounded-lg border border-surface-border bg-surface-card p-3 text-xs">
                    <div className="flex justify-between">
                      <span>prevent_duplicate_topic</span>
                      <Badge className="bg-semantic-success-bg text-semantic-success">true</Badge>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>Chương 1 · EASY (10 câu)</span>
                      <span>5.0đ</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>Chương 2 · MEDIUM/HARD (10 câu)</span>
                      <span>5.0đ</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 21st.dev Excel Dropzone 2-Step */}
              <div className="space-y-3 rounded-lg border border-surface-border bg-surface-muted p-4 lg:col-span-6">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <FileSpreadsheet className="h-4 w-4 text-brand-600" /> Import Excel thí sinh (2 bước)
                  </span>
                  <Badge variant="outline" className="font-mono text-semantic-warning">
                    Preview TTL: 15p
                  </Badge>
                </div>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-surface-border bg-surface-card p-4 text-center transition-colors hover:border-brand-500">
                  <UploadCloud className="mb-1.5 h-7 w-7 text-text-secondary" />
                  <span className="text-xs font-semibold">{excelFile}</span>
                  <span className="text-xs text-text-secondary">Kéo thả file .xlsx để gọi POST .../import/preview</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setExcelFile(f.name);
                        setCommitDone(false);
                      }
                    }}
                  />
                </label>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span>Hợp lệ: <strong className="font-mono text-semantic-success">118 / 120</strong> (2 trùng SBD)</span>
                    <span className="font-mono">98%</span>
                  </div>
                  <Progress value={98} className="h-2" />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-xs text-text-secondary">
                    {commitDone ? '✓ Đã commit vào kỳ thi' : 'POST .../import/commit'}
                  </span>
                  <Button size="sm" onClick={() => setCommitDone(true)}>
                    {commitDone ? 'Đã xác nhận Commit (118)' : 'Xác nhận Commit (118)'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================================
            PHÂN HỆ D: PHÒNG THI TRỰC TUYẾN & AUTOSAVE CAS
           ============================================================ */}
        <Card>
          <CardHeader className="border-b border-surface-border pb-4">
            <CardTitle className="text-lg">
              Phân hệ D — Focus Exam Shell (<code className="font-mono text-sm">/me/exams</code>, <code className="font-mono text-sm">/me/submissions</code>)
            </CardTitle>
            <CardDescription>
              Đồng hồ tabular-nums ổn định (không nhấp nháy liên tục) · Tín hiệu Autosave CAS · AlertDialog Submit Idempotency-Key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-muted p-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Badge className="font-mono">MÃ ĐỀ 102</Badge>
                <span className="font-bold">Kỳ thi Giữa kỳ Giải tích 1</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCasState((s) => (s === 'saved' ? 'saving' : s === 'saving' ? 'error' : 'saved'))}
                  className="rounded-full border border-surface-border bg-surface-card px-3 py-1 font-semibold"
                  style={{
                    color:
                      casState === 'saved'
                        ? 'var(--olms-exam-status-saved)'
                        : casState === 'saving'
                          ? 'var(--olms-exam-status-saving)'
                          : 'var(--olms-semantic-error)',
                  }}
                >
                  {casState === 'saved'
                    ? '✓ Đã lưu (CAS)'
                    : casState === 'saving'
                      ? 'Đang lưu...'
                      : '⚠ Xung đột phiên'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTimerMode((m) => (m === 'normal' ? 'warning' : m === 'warning' ? 'critical' : 'normal'))
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-card px-3 py-1 font-mono font-bold tabular-nums"
                  style={{
                    color:
                      timerMode === 'normal'
                        ? 'var(--olms-timer-normal)'
                        : timerMode === 'warning'
                          ? 'var(--olms-timer-warning)'
                          : 'var(--olms-timer-critical)',
                  }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {timerMode === 'normal' ? '42:18' : timerMode === 'warning' ? '04:50 (Sắp hết giờ)' : '00:45 (Khẩn cấp)'}
                </button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> Nộp bài
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận nộp bài thi?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bạn đã trả lời 14/20 câu, còn 6 câu chưa làm và {flaggedQ3 ? 1 : 0} câu đang gắn cờ. Yêu cầu sẽ gửi kèm <code className="font-mono">Idempotency-Key</code>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Kiểm tra lại</AlertDialogCancel>
                      <AlertDialogAction onClick={() => setSubmittedMsg('✓ Đã nộp bài thành công (Idempotent)')}>
                        Xác nhận nộp bài
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {submittedMsg && (
              <div className="rounded-md border border-surface-border bg-semantic-success-bg px-3 py-2 text-xs font-semibold text-semantic-success">
                {submittedMsg}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="space-y-3 rounded-lg border border-surface-border p-4 text-xs lg:col-span-8">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Câu 3 / 20 · Chọn phương án để kích hoạt Autosave CAS</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFlaggedQ3((f) => !f)}
                    style={flaggedQ3 ? { color: 'var(--olms-answer-flagged)' } : undefined}
                  >
                    <Flag className="mr-1.5 h-3.5 w-3.5" />
                    {flaggedQ3 ? 'Đang gắn cờ' : 'Gắn cờ'}
                  </Button>
                </div>

                <RadioGroup
                  value={selectedSingle}
                  onValueChange={(val) => {
                    setSelectedSingle(val);
                    triggerCasSave();
                  }}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {[
                    { k: 'A', t: "f'(x) = 3x²" },
                    { k: 'B', t: "f'(x) = 6x" },
                    { k: 'C', t: "f'(x) = 2x" },
                    { k: 'D', t: "f'(x) = 0" },
                  ].map((item) => (
                    <label
                      key={item.k}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 ${
                        selectedSingle === item.k ? 'border-brand-600 bg-semantic-info-bg font-semibold' : 'border-surface-border'
                      }`}
                    >
                      <RadioGroupItem value={item.k} />
                      <span>{item.k}. {item.t}</span>
                    </label>
                  ))}
                </RadioGroup>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="text-text-secondary">Mẫu CheckboxCard:</span>
                  {['A', 'B'].map((k) => (
                    <label key={k} className="inline-flex cursor-pointer items-center gap-1.5">
                      <Checkbox checked={selectedMulti.includes(k)} onCheckedChange={() => toggleMulti(k)} />
                      <span>Phương án {k}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-surface-border bg-surface-muted p-4 text-xs lg:col-span-4">
                <div className="font-bold">Bảng câu hỏi (Question Palette)</div>
                <div className="grid grid-cols-5 gap-2 font-mono">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isFlag = (num === 3 && flaggedQ3) || num === 7;
                    const isDone = [1, 2, 3, 4].includes(num);
                    const bg = isFlag
                      ? 'var(--olms-answer-flagged)'
                      : isDone
                        ? 'var(--olms-answer-answered)'
                        : 'var(--olms-surface-card)';
                    const color = isFlag || isDone ? 'var(--olms-text-inverse)' : 'var(--olms-text-secondary)';
                    return (
                      <div
                        key={num}
                        className="rounded border border-surface-border py-2 text-center font-bold"
                        style={{ background: bg, color }}
                      >
                        {num}
                        {isFlag ? '⚑' : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
