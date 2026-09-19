import { captureDialogOpener, restoreDialogFocus, isDialogBackdropClick } from '../ui/dialog-focus';
import { useSubmitOnce } from '../ui/useSubmitOnce';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../auth/auth-context';
import { ClientApiError, clientKeys, createClient } from '../../clients/client-api';
import { clientFormSchema, type ClientFormInput } from '../../clients/client-schemas';
import { IconButton } from '../ui/IconButton';
import { ClientFormFields } from './ClientFormFields';

interface ClientCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

export function ClientCreateDialog({ open, onClose, onCreated }: ClientCreateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { name: '', email: '', phone: '', company: '' },
  });
  const mutation = useMutation({ mutationFn: createClient });

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = captureDialogOpener(dialog);
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      restoreDialogFocus(opener, dialog);
    };
  }, [open]);

  function close() {
    if (mutation.isPending) return;
    mutation.reset();
    reset();
    onClose();
  }

  const submit = useSubmitOnce(async (input: ClientFormInput) => {
    try {
      const created = await mutation.mutateAsync(input);
      if (user) await queryClient.invalidateQueries({ queryKey: clientKeys.all(user.id) });
      reset();
      onCreated(created.name);
      onClose();
    } catch (error) {
      if (error instanceof ClientApiError) {
        for (const field of error.fields) {
          if (['name', 'email', 'phone', 'company'].includes(field.field)) {
            setError(field.field as keyof ClientFormInput, { message: field.message });
          }
        }
        setError('root', { message: error.message });
      } else {
        setError('root', { message: 'Não foi possível criar o cliente. Tente novamente.' });
      }
    }
  });

  return (
    <dialog
      ref={dialogRef}
      className="client-dialog"
      aria-labelledby="create-client-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (isDialogBackdropClick(event)) close();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="navigation-label">Novo contato</p>
          <h2 id="create-client-title">Cadastrar cliente</h2>
          <p>Adicione os dados essenciais para começar.</p>
        </div>
        <IconButton label="Fechar cadastro" onClick={close} disabled={mutation.isPending}>
          <X size={19} strokeWidth={1.7} aria-hidden="true" />
        </IconButton>
      </div>
      <form
        className="client-form"
        noValidate
        aria-busy={mutation.isPending}
        onSubmit={(event) => void handleSubmit(submit)(event)}
      >
        <ClientFormFields register={register} errors={errors} autoFocusName />
        {errors.root && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={close}
            disabled={mutation.isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="primary-button"
            data-client-action="create"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Salvando…' : 'Cadastrar cliente'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
