import { useSubmitOnce } from '../components/ui/useSubmitOnce';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { ApiError } from '../auth/auth-api';
import { loginSchema, type LoginInput } from '../auth/auth-schemas';
import { AuthLayout } from '../components/auth/AuthLayout';
import { FormField } from '../components/auth/FormField';

export function LoginPage() {
  const { signIn } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const submit = useSubmitOnce(async (input: LoginInput) => {
    try {
      await signIn('login', input);
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError ? error.message : 'Não foi possível entrar. Tente novamente.',
      });
    }
  });
  return (
    <AuthLayout
      title="Entre no seu workspace"
      description="Acesse sua conta para continuar de onde parou."
      footer={
        <>
          Ainda não tem uma conta? <Link to="/register">Criar conta</Link>
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
          autoComplete="current-password"
          required
          {...register('password')}
          error={errors.password?.message}
        />
        {errors.root && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  );
}
