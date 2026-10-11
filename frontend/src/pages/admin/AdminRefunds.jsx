import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { RotateCcw, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AdminPage, StatCard } from '@/components/admin/AdminUI';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/order/OrderParts';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Form';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import { Badge, EmptyState, ErrorState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { formatPrice, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const TABS = [
  ['requested', 'Return requests'],
  ['pending', 'Refunds pending'],
  ['processed', 'Refunded'],
  ['all', 'All'],
];
const REFUND_TONE = { none: 'neutral', pending: 'warning', failed: 'danger', processed: 'success' };

export default function AdminRefunds() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [status, setStatus] = useState('requested');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'refunds', status, page], queryFn: () => adminApi.refunds({ status, page }), placeholderData: keepPreviousData });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };
  const approve = useMutation({ mutationFn: (id) => adminApi.approveRefund(id), onSuccess: (r) => (toast.success(r.message), invalidate()), onError: (e) => toast.error(getErrorMessage(e)) });
  const reject = useMutation({
    mutationFn: () => adminApi.rejectRefund(rejecting._id, reason),
    onSuccess: (r) => {
      toast.success(r.message);
      setRejecting(null);
      setReason('');
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const s = data?.summary || {};

  const columns = [
    {
      key: 'order',
      header: 'Order',
      render: (o) => (
        <Link to={`/admin/orders/${o._id}`} className="font-bold hover:underline" onClick={(e) => e.stopPropagation()}>
          {o.orderNumber}
        </Link>
      ),
    },
    { key: 'customer', header: 'Customer', render: (o) => <span className="font-semibold">{o.contact?.name}</span> },
    { key: 'amount', header: 'Amount', render: (o) => <b className="tabular-nums">{formatPrice(o.refundAmount || o.total)}</b> },
    { key: 'reason', header: 'Reason', render: (o) => <span className="line-clamp-2 text-sm text-muted">{o.returnReason || '—'}</span>, hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <div className="flex flex-wrap gap-1">
          <OrderStatusBadge status={o.orderStatus} />
          <PaymentStatusBadge status={o.paymentStatus} />
          {o.refundStatus !== 'none' && <Badge tone={REFUND_TONE[o.refundStatus]}>Refund {o.refundStatus}</Badge>}
        </div>
      ),
    },
    { key: 'ref', header: 'Refund ID', render: (o) => <span className="font-mono text-xs">{o.payment?.refundId || '—'}</span>, hideOnMobile: true },
    { key: 'date', header: 'Updated', render: (o) => <span className="text-xs">{formatDateTime(o.updatedAt)}</span>, hideOnMobile: true },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (o) => {
        const canApprove = o.orderStatus === 'RETURN_REQUESTED' || (o.paymentStatus === 'PAID' && ['pending', 'failed'].includes(o.refundStatus));
        return (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canApprove && (
              <Button
                size="xs"
                leftIcon={<Check className="h-3.5 w-3.5" />}
                loading={approve.isPending && approve.variables === o._id}
                onClick={async () => {
                  const isReturn = o.orderStatus === 'RETURN_REQUESTED';
                  if (await confirm({ title: isReturn ? 'Approve this return?' : 'Retry this refund?', description: `${formatPrice(o.total)} will be refunded via Razorpay to the original payment method${isReturn ? ' and the items restocked' : ''}.`, confirmText: 'Approve refund' })) approve.mutate(o._id);
                }}
              >
                Approve
              </Button>
            )}
            {o.orderStatus === 'RETURN_REQUESTED' && (
              <Button size="xs" variant="danger-soft" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => setRejecting(o)}>
                Reject
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AdminPage title="Refunds" description="Review return requests and track every refund. Refunds are issued through Razorpay on the server.">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={isLoading} label="Return requests" value={s.requested ?? 0} icon={RotateCcw} tone="bg-warning-soft text-warning" />
        <StatCard loading={isLoading} label="Refunds needing action" value={s.pending ?? 0} tone="bg-danger-soft text-danger" />
        <StatCard loading={isLoading} label="Refunds processed" value={s.processedCount ?? 0} tone="bg-success-soft text-success" />
        <StatCard loading={isLoading} label="Amount refunded" value={formatPrice(s.processedAmount || 0)} />
      </div>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {TABS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} onClick={() => (setStatus(v), setPage(1))} className={cn('rounded-full border px-4 py-2 text-sm font-semibold transition', status === v ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface hover:border-ink')}>
            {l}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable columns={columns} rows={data?.items || []} loading={isLoading} empty={<EmptyState icon={RotateCcw} title="Nothing here" description="Return requests and refunds will appear in this list." />} />
      )}
      <Pagination className="mt-6" page={page} pages={data?.pagination?.pages} onChange={setPage} />

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject return for ${rejecting?.orderNumber}?`}
        description="The order goes back to Delivered and the customer is notified with your reason."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={reject.isPending} disabled={reason.trim().length < 5} onClick={() => reject.mutate()}>
              Reject request
            </Button>
          </>
        }
      >
        <Textarea label="Reason shown to the customer" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. The item shows signs of use and isn’t eligible for return." />
      </Modal>
    </AdminPage>
  );
}
