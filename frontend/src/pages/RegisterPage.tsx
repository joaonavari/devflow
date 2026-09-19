import { useSubmitOnce } from '../components/ui/useSubmitOnce';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { ApiError } from '../auth/auth-api';
import { registerSchema, type RegisterInput } from '../auth/auth-schemas';
import { AuthLayout } from '../components/auth/AuthLayout';
import { FormField } from '../components/auth/FormField';

export function RegisterPage() {
  const { signIn } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const submit = useSubmitOnce(async (input: RegisterInput) => {
    try {
      await signIn('register', {
        name: input.name,
        email: input.email,
        password: input.password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError
            ? error.message
            : 'Não foi possível criar sua conta. Tente novamente.',
      });
    }
  });
  return (
    <AuthLayout
      title="Crie sua conta"
      description="Um espaço para organizar o seu trabalho."
      footer={
        <>
          Já tem uma conta? <Link to="/login">Entrar</Link>
        </>
      }
    >
      <form
        className="auth-form"
        noValidate
        onSubmit={(event) => {
          void handleSubmit(submit)(event);
        }}
        aria-busy={isSubmitting}
      >
        <FormField
          label="Nome"
          type="text"
          autoComplete="name"
          required
          maxLength={100}
          {...register('name')}
          error={errors.name?.message}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          {...register('email')}
          error={errors.email?.message}
        />
        <FormField
          label="Senha"
          type="password"
          autoComplete="new-password"
          required
          hint="Use pelo menos 8 caracteres."
          {...register('password')}
          error={errors.password?.message}
        />
        <FormField
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          required
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        {errors.root && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  );
}
