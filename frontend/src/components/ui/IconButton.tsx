import type { ComponentPropsWithoutRef } from 'react';

type IconButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'aria-label'> & {
  label: string;
};

export function IconButton({ label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
    />
  );
}
