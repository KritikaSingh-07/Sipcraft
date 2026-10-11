import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Plus, CreditCard, Smartphone, Landmark, Wallet, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { userApi, paymentApi, couponApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useCart, useCartActions } from '@/hooks/useCart';
import { useSettings } from '@/hooks/queries';
import { useConfirm } from '@/contexts/ConfirmContext';
import { contactInfoSchema } from '@/validators/schemas';
import { openRazorpayCheckout } from '@/utils/razorpay';
import { CheckoutSummary, CouponInput, AddressForm, AddressCard } from '@/components/checkout/CheckoutParts';
import { Input } from '@/components/ui/Form';
import { Skeleton, FullPageLoader } from '@/components/ui/Feedback';
import { PageTransition } from '@/components/ui/Motion';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { Logo } from '@/components/layout/Brand';
import { formatPrice } from '@/utils/format';

function Step({ n, title, children, done, action }) {
  return (
    <section className="card p-6 sm:p-8" aria-labelledby={`step-${n}`}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id={`step-${n}`} className="flex items-center gap-3 text-lg font-bold tracking-tight">
          <span className={`grid h-8 w-8 place-items-center rounded-full text-sm ${done ? 'bg-success text-white' : 'bg-ink text-white'}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : n}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProcessingOverlay({ stage }) {
  return (
    <AnimatePresence>
      {stage && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-canvas/90 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alertdialog" aria-live="assertive" aria-label="Processing payment">
          <div className="flex flex-col items-center px-6 text-center">
            <motion.div className="relative h-20 w-20" animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}>
              <span className="absolute inset-0 rounded-full border-4 border-line" />
              <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand" />
            </motion.div>
            <p className="mt-8 text-xl font-bold">{stage === 'creating' ? 'Preparing secure checkout…' : 'Confirming your payment…'}</p>
            <p className="mt-2 max-w-xs text-sm text-muted">{stage === 'verifying' ? 'Please don’t close or refresh this page.' : 'Reserving your items and opening Razorpay.'}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Checkout() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { cart, isLoading } = useCart();
  const { applyCoupon, removeCoupon } = useCartActions();
  const { data: settings } = useSettings();
  const { data: coupons } = useQuery({ queryKey: ['coupons', 'public'], queryFn: couponApi.publicList, staleTime: 5 * 60_000 });
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: userApi.addresses });
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | address
  const [stage, setStage] = useState(null);
  const [pending, setPending] = useState(null); // { orderId, expiresAt } after a dismissed/failed payment
  const [paymentError, setPaymentError] = useState(null);

  const contactForm = useForm({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '', phone: user?.phone || '' },
  });

  const list = useMemo(() => addresses.data || [], [addresses.data]);
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!list.length) {
      // First visit with no saved addresses: open the form once (not again while a save refetches).
      if (addresses.isSuccess && !autoOpened.current) {
        autoOpened.current = true;
        setEditing('new');
      }
      return;
    }
    if (!selectedId || !list.some((a) => a._id === selectedId)) setSelectedId((list.find((a) => a.isDefault) || list[0])._id);
  }, [list, selectedId, addresses.isSuccess]);

  const saveAddress = useMutation({
    mutationFn: (values) => (editing && editing !== 'new' ? userApi.updateAddress(editing._id, values) : userApi.createAddress(values)),
    onSuccess: (res) => {
      // Update the cache immediately so the new address is selectable without waiting for a refetch.
      queryClient.setQueryData(['addresses'], (old = []) => {
        const rest = old.filter((a) => a._id !== res.data._id).map((a) => (res.data.isDefault ? { ...a, isDefault: false } : a));
        return [res.data, ...rest];
      });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setSelectedId(res.data._id);
      setEditing(null);
      toast.success(res.message);
      if (!contactForm.getValues('phone')) contactForm.setValue('phone', res.data.phone);
    },
  });
  const deleteAddress = useMutation({
    mutationFn: (id) => userApi.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Address deleted');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const makeDefault = useMutation({
    mutationFn: (id) => userApi.setDefaultAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const finishPayment = async (rzpOrder, response) => {
    setStage('verifying');
    try {
      const res = await paymentApi.verify(response);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      navigate(`/order-success/${res.data.orderId}`, { replace: true });
    } catch (err) {
      setPaymentError(getErrorMessage(err));
      setPending({ orderId: rzpOrder.orderId, expiresAt: rzpOrder.expiresAt });
    } finally {
      setStage(null);
    }
  };

  const launch = async (rzpOrder) => {
    try {
      const response = await openRazorpayCheckout(rzpOrder, {
        onFailure: (err) => paymentApi.failed({ razorpay_order_id: rzpOrder.razorpayOrderId, reason: err?.description }).catch(() => {}),
      });
      await finishPayment(rzpOrder, response);
    } catch (err) {
      if (err?.reason === 'dismissed') {
        setPending({ orderId: rzpOrder.orderId, expiresAt: rzpOrder.expiresAt });
        setPaymentError(null);
        toast.info('Payment not completed. Your items are reserved for a few minutes.');
      } else {
        setPaymentError(err?.message || 'Could not open the payment window.');
        setPending({ orderId: rzpOrder.orderId, expiresAt: rzpOrder.expiresAt });
      }
    }
  };

  const pay = contactForm.handleSubmit(async (contact) => {
    if (!selectedId) {
      toast.error('Please add or select a shipping address');
      return;
    }
    setPaymentError(null);
    setStage('creating');
    try {
      const rzpOrder = pending
        ? await paymentApi.retry(pending.orderId).catch(() => paymentApi.createOrder({ addressId: selectedId, contact, couponCode: cart.couponCode || undefined }))
        : await paymentApi.createOrder({ addressId: selectedId, contact, couponCode: cart.couponCode || undefined });
      setStage(null);
      await launch(rzpOrder);
    } catch (err) {
      setStage(null);
      const msg = getErrorMessage(err);
      setPaymentError(msg);
      toast.error(msg);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    }
  });

  if (isLoading || addresses.isLoading) {
    return (
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }
  if (!cart.items.length && !stage) return <Navigate to="/cart" replace />;
  if (stage === 'verifying' && !cart.items.length) return <FullPageLoader label="Confirming payment" />;

  const paymentsEnabled = settings?.paymentsEnabled !== false;
  const blocked = cart.items.some((i) => !i.available);

  return (
    <PageTransition className="container-page py-8 lg:py-12">
      <Seo title="Checkout" noindex />
      <ProcessingOverlay stage={stage} />
      <div className="mb-8 flex items-center justify-between">
        <h1 className="display text-4xl sm:text-5xl">Checkout</h1>
        <span className="hidden items-center gap-2 text-sm text-muted sm:flex">
          <Lock className="h-4 w-4" /> Secure SSL checkout
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:gap-12">
        <div className="space-y-6">
          <Step n={1} title="Contact information">
            <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => e.preventDefault()} noValidate>
              <Input label="Full name" autoComplete="name" required error={contactForm.formState.errors.name?.message} {...contactForm.register('name')} />
              <Input label="Email" type="email" autoComplete="email" required error={contactForm.formState.errors.email?.message} {...contactForm.register('email')} />
              <Input label="Phone" type="tel" autoComplete="tel" required error={contactForm.formState.errors.phone?.message} {...contactForm.register('phone')} />
            </form>
            <p className="mt-3 text-[13px] text-muted">We’ll send order and delivery updates here.</p>
          </Step>

          <Step
            n={2}
            title="Shipping address"
            done={Boolean(selectedId) && !editing}
            action={
              list.length > 0 &&
              !editing && (
                <Button size="sm" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                  Add new
                </Button>
              )
            }
          >
            {editing ? (
              <AddressForm
                initial={editing === 'new' ? { fullName: contactForm.getValues('name'), phone: contactForm.getValues('phone'), isDefault: list.length === 0 } : editing}
                onSubmit={(values) => saveAddress.mutateAsync(values)}
                onCancel={list.length ? () => setEditing(null) : undefined}
                submitting={saveAddress.isPending}
                submitLabel={editing === 'new' ? 'Save & use this address' : 'Update address'}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((a) => (
                  <AddressCard
                    key={a._id}
                    address={a}
                    selectable
                    selected={a._id === selectedId}
                    onSelect={() => setSelectedId(a._id)}
                    onEdit={() => setEditing(a)}
                    onMakeDefault={() => makeDefault.mutate(a._id)}
                    onDelete={async () => {
                      if (await confirm({ title: 'Delete this address?', description: `${a.address}, ${a.city}`, confirmText: 'Delete', tone: 'danger' })) deleteAddress.mutate(a._id);
                    }}
                  />
                ))}
              </div>
            )}
          </Step>

          <Step n={3} title="Payment method">
            <div className="rounded-3xl border border-ink p-5 ring-1 ring-ink">
              <div className="flex items-center gap-3">
                <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-ink">
                  <span className="h-2.5 w-2.5 rounded-full bg-ink" />
                </span>
                <span className="font-bold">Pay securely with Razorpay</span>
                <ShieldCheck className="ml-auto h-5 w-5 text-success" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  [Smartphone, 'UPI'],
                  [CreditCard, 'Cards'],
                  [Landmark, 'Netbanking'],
                  [Wallet, 'Wallets'],
                ].map(([Icon, l]) => (
                  <span key={l} className="flex items-center gap-2 rounded-2xl bg-sand px-3 py-2.5 text-sm font-semibold">
                    <Icon className="h-4 w-4 text-brand" /> {l}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[13px] text-muted">You’ll choose your preferred method in the Razorpay window. We never see or store your card details.</p>
            </div>
            {!paymentsEnabled && (
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-warning-soft p-4 text-sm text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Online payments are temporarily unavailable. Please try again shortly.
              </p>
            )}
          </Step>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CheckoutSummary totals={cart.totals} items={cart.items}>
            <div className="mt-6">
              <CouponInput
                appliedCode={cart.couponCode}
                onApply={(code) => applyCoupon.mutateAsync(code)}
                onRemove={() => removeCoupon.mutate()}
                applying={applyCoupon.isPending}
                disabled={Boolean(pending)}
                disabledHint="Complete or cancel the pending payment to change coupons."
                suggestions={(coupons || []).filter((c) => (cart.totals?.subtotal || 0) >= c.minimumOrderAmount)}
              />
            </div>

            <AnimatePresence>
              {(paymentError || pending) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className={`mt-6 rounded-2xl p-4 text-sm ${paymentError ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`} role="alert">
                    <p className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="h-4 w-4" /> {paymentError ? 'Payment failed' : 'Payment not completed'}
                    </p>
                    <p className="mt-1 opacity-90">{paymentError || 'No money was taken. You can retry below — your items stay reserved for a few minutes.'}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button size="lg" fullWidth className="mt-6" onClick={pay} loading={Boolean(stage)} disabled={!paymentsEnabled || blocked || Boolean(editing)} leftIcon={<Lock className="h-4 w-4" />}>
              {pending ? 'Retry payment' : 'Pay'} {cart.totals ? formatPrice(cart.totals.total) : ''}
            </Button>
            {editing && <p className="mt-2 text-center text-[13px] text-muted">Save your address to continue</p>}
            <p className="mt-4 text-center text-xs leading-5 text-muted">
              By placing this order you agree to our{' '}
              <Link to="/terms" className="underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/refund" className="underline">
                Refund policy
              </Link>
              .
            </p>
          </CheckoutSummary>
          <div className="mt-6 flex items-center justify-center gap-2 opacity-60">
            <Logo />
          </div>
        </aside>
      </div>
    </PageTransition>
  );
}
