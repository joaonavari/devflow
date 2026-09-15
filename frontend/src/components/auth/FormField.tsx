import { useId, type ComponentPropsWithoutRef } from 'react';

type FormFieldProps = ComponentPropsWithoutRef<'input'> & {
  label: string;
  error?: string | undefined;
  hint?: string;
};
export function FormField({ label, error, hint, ...input }: FormFieldProps) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...input}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-help` : undefined}
      />
      {(error ?? hint) && (
        <p id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
