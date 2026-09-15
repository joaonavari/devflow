import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { Client } from '../../clients/client-api';
import { ClientApiError, clientKeys, updateClient } from '../../clients/client-api';
import { clientFormSchema, type ClientFormInput } from '../../clients/client-schemas';
import { useAuth } from '../../auth/auth-context';
import { ClientFormFields } from './ClientFormFields';

interface ClientEditFormProps {
  client: Client;
  onSaved: (client: Client) => void;
}

export function ClientEditForm({ client, onSaved }: ClientEditFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client.name,
      email: client.email,
      phone: client.phone ?? '',
      company: client.company ?? '',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: ClientFormInput) => updateClient(client.id, input),
  });

  async function submit(input: ClientFormInput) {
    try {
      const updated = await mutation.mutateAsync(input);
      reset({
        name: updated.name,
        email: updated.email,
        phone: updated.phone ?? '',
        company: updated.company ?? '',
      });
      if (user) {
        queryClient.setQueryData(clientKeys.detail(user.id, client.id), updated);
        await queryClient.invalidateQueries({ queryKey: clientKeys.all(user.id) });
      }
      onSaved(updated);
    } catch (error) {
      if (error instanceof ClientApiError) {
        for (const field of error.fields) {
          if (['name', 'email', 'phone', 'company'].includes(field.field)) {
            setError(field.field as keyof ClientFormInput, { message: field.message });
          }
        }
        setError('root', { message: error.message });
      } else {
        setError('root', { message: 'Não foi possível salvar as alterações.' });
      }
    }
  }

  return (
    <form
      className="client-detail-form"
      noValidate
      aria-busy={mutation.isPending}
      onSubmit={(event) => void handleSubmit(submit)(event)}
    >
      <ClientFormFields register={register} errors={errors} />
      {errors.root && (
        <p className="form-error" role="alert">
          {errors.root.message}
        </p>
      )}
      <div className="detail-form-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!isDirty || mutation.isPending}
          onClick={() => {
            reset();
          }}
        >
          Descartar
        </button>
        <button
          type="submit"
          className="primary-button"
          data-client-action="save"
          disabled={!isDirty || mutation.isPending}
        >
          {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
