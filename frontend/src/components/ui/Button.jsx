import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const MotionLink = motion.create(Link);

const variants = {
  primary: 'bg-ink text-white hover:bg-ink-soft shadow-[0_10px_30px_-12px_rgb(23_22_28/0.6)]',
  brand: 'bg-brand text-white hover:bg-brand-dark shadow-glow',
  secondary: 'bg-surface text-ink border border-line-strong hover:border-ink',
  soft: 'bg-brand-soft text-brand-dark hover:bg-[#e4ddf8]',
  ghost: 'text-ink hover:bg-sand',
  danger: 'bg-danger text-white hover:bg-[#b03535]',
  'danger-soft': 'bg-danger-soft text-danger hover:bg-[#f7dada]',
  link: 'text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink px-0 h-auto',
  light: 'bg-white text-ink hover:bg-white/90',
};

const sizes = {
  xs: 'h-8 px-3 text-xs gap-1.5',
  sm: 'h-10 px-4 text-sm gap-2',
  md: 'h-12 px-6 text-sm gap-2',
  lg: 'h-14 px-8 text-base gap-2.5',
  icon: 'h-10 w-10 justify-center',
  'icon-sm': 'h-8 w-8 justify-center',
};

/**
 * Pill button with micro-interactions. Renders a <Link> when `to` is given,
 * an <a> for `href`, otherwise a <button>. Shows a spinner while `loading`.
 */
const Button = forwardRef(function Button(
  { as, to, href, variant = 'primary', size = 'md', loading = false, disabled, className, children, leftIcon, rightIcon, fullWidth, type = 'button', ...props },
  ref,
) {
  const classes = cn(
    'relative inline-flex select-none items-center justify-center rounded-full font-semibold tracking-[-0.01em] whitespace-nowrap',
    'transition-[background-color,border-color,color,box-shadow,opacity] duration-200 disabled:opacity-50',
    variants[variant],
    ['primary', 'brand', 'light'].includes(variant) && 'btn-shine',
    variant !== 'link' && sizes[size],
    fullWidth && 'w-full',
    className,
  );
  const content = (
    <>
      {loading && <Loader2 className="absolute h-4 w-4 animate-spin" aria-hidden />}
      <span className={cn('inline-flex items-center gap-[inherit]', loading && 'invisible')}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </>
  );
  const motionProps = disabled || loading ? {} : { whileTap: { scale: 0.97 } };

  if (to) {
    return (
      <MotionLink ref={ref} to={to} className={classes} {...motionProps} {...props}>
        {content}
      </MotionLink>
    );
  }
  if (href) {
    return (
      <motion.a ref={ref} href={href} className={classes} {...motionProps} {...props}>
        {content}
      </motion.a>
    );
  }
  const Comp = as || motion.button;
  return (
    <Comp ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...motionProps} {...props}>
      {content}
    </Comp>
  );
});

export default Button;
