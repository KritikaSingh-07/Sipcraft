import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Inbox, Mail, Phone, Trash2, Reply, Archive, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Form';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AdminPage, Toolbar, FilterSelect } from '@/components/admin/AdminUI';
import Pagination from '@/components/ui/Pagination';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const TONES = { new: 'brand', read: 'neutral', replied: 'info', resolved: 'success', archived: 'neutral' };

export default function AdminMessages() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const debounced = useDebounce(search, 350);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'messages', status, page, debounced], queryFn: () => adminApi.messages({ status, page, search: debounced }), placeholderData: keepPreviousData });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'messages'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };
  const setMsgStatus = useMutation({ mutationFn: ({ id, s }) => adminApi.updateMessage(id, s), onSuccess: invalidate, onError: (e) => toast.error(getErrorMessage(e)) });
  const reply = useMutation({
    mutationFn: () => adminApi.replyMessage(replyTo._id, replyText),
    onSuccess: () => {
      toast.success('Reply sent to ' + replyTo.email);
      setReplyTo(null);
      setReplyText('');
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({ mutationFn: adminApi.deleteMessage, onSuccess: () => (toast.success('Message deleted'), invalidate()) });

  const open = (m) => {
    setOpenId(openId === m._id ? null : m._id);
    if (m.status === 'new') setMsgStatus.mutate({ id: m._id, s: 'read' });
  };

  return (
    <AdminPage title="Messages" description={`Contact form submissions${data?.unread ? ` · ${data.unread} new` : ''}`}>
      <Toolbar search={search} onSearch={(v) => (setSearch(v), setPage(1))} placeholder="Search name, email or subject">
        <FilterSelect label="Status" value={status} onChange={(v) => (setStatus(v), setPage(1))} options={[{ value: 'all', label: 'All messages' }, { value: 'new', label: 'New' }, { value: 'read', label: 'Read' }, { value: 'replied', label: 'Replied' }, { value: 'resolved', label: 'Resolved' }, { value: 'archived', label: 'Archived' }]} />
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-3xl" />
          ))}
        </div>
      ) : !data.items.length ? (
        <EmptyState icon={Inbox} title="Inbox zero" description="New contact form messages will land here — we’ll email you too." />
      ) : (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m._id} className={cn('card overflow-hidden', m.status === 'new' && 'border-brand/40')}>
              <button onClick={() => open(m)} className="flex w-full items-center gap-4 p-5 text-left" aria-expanded={openId === m._id}>
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', m.status === 'new' ? 'bg-brand' : 'bg-transparent')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate', m.status === 'new' ? 'font-bold' : 'font-semibold')}>{m.subject}</p>
                  <p className="truncate text-sm text-muted">
                    {m.name} · {m.email}
                  </p>
                </div>
                <Badge tone={TONES[m.status]} className="hidden sm:inline-flex">
                  {m.status}
                </Badge>
                <span className="hidden text-xs text-muted md:block">{formatDateTime(m.createdAt)}</span>
              </button>
              {openId === m._id && (
                <div className="border-t border-line bg-canvas/60 p-5">
                  <p className="text-[15px] leading-7 whitespace-pre-line">{m.message}</p>
                  {m.replies?.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {m.replies.map((r, i) => (
                        <li key={i} className="rounded-2xl border border-line bg-surface p-3 text-sm">
                          <p className="text-xs font-semibold text-muted">Your reply · {formatDateTime(r.at)}</p>
                          <p className="mt-1 whitespace-pre-line">{r.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4" /> {m.email}
                    </span>
                    {m.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4" /> {m.phone}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="xs" leftIcon={<Reply className="h-3.5 w-3.5" />} onClick={() => setReplyTo(m)}>
                      Reply by email
                    </Button>
                    {m.status !== 'resolved' && (
                      <Button size="xs" variant="soft" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setMsgStatus.mutate({ id: m._id, s: 'resolved' })}>
                        Mark resolved
                      </Button>
                    )}
                    <Button size="xs" variant="secondary" leftIcon={<Archive className="h-3.5 w-3.5" />} onClick={() => setMsgStatus.mutate({ id: m._id, s: 'archived' })}>
                      Archive
                    </Button>
                    <Button
                      size="xs"
                      variant="danger-soft"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={async () => {
                        if (await confirm({ title: 'Delete this message?', confirmText: 'Delete', tone: 'danger' })) remove.mutate(m._id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={page} pages={data?.pagination?.pages} onChange={setPage} />
      <Modal
        open={Boolean(replyTo)}
        onClose={() => setReplyTo(null)}
        title={`Reply to ${replyTo?.name}`}
        description={`Sent to ${replyTo?.email} from the store email address.`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplyTo(null)}>
              Cancel
            </Button>
            <Button loading={reply.isPending} disabled={replyText.trim().length < 2} onClick={() => reply.mutate()} leftIcon={<Reply className="h-4 w-4" />}>
              Send reply
            </Button>
          </>
        }
      >
        <p className="mb-4 rounded-2xl bg-sand p-3 text-sm text-muted">“{replyTo?.message}”</p>
        <Textarea label="Your reply" rows={7} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Hi ${replyTo?.name?.split(' ')[0] || ''},`} />
      </Modal>
    </AdminPage>
  );
}
