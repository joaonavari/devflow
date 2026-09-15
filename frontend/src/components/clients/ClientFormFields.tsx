import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { ClientFormInput } from '../../clients/client-schemas';
import { FormField } from '../auth/FormField';

interface ClientFormFieldsProps {
  register: UseFormRegister<ClientFormInput>;
  errors: FieldErrors<ClientFormInput>;
  autoFocusName?: boolean;
}

export function ClientFormFields({
  register,
  errors,
  autoFocusName = false,
}: ClientFormFieldsProps) {
  return (
    <div className="client-form-fields">
      <FormField
        label="Nome"
        type="text"
        autoComplete="name"
        maxLength={120}
        autoFocus={autoFocusName}
        required
        {...register('name')}
        error={errors.name?.message}
      />
      <FormField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        required
        {...register('email')}
        error={errors.email?.message}
      />
      <FormField
        label="Telefone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={40}
        placeholder="Opcional"
        {...register('phone')}
        error={errors.phone?.message}
      />
      <FormField
        label="Empresa"
        type="text"
        autoComplete="organization"
        maxLength={120}
        placeholder="Opcional"
        {...register('company')}
        error={errors.company?.message}
      />
    </div>
  );
}
