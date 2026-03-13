"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Stethoscope, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("E-mail ou senha incorretos. Tente novamente.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fade-in">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-xl mb-4 shadow-lg shadow-primary-200">
          <Stethoscope className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">MedCRM</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestão inteligente de leads para clínicas
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="label">E-mail</label>
          <input
            {...register("email")}
            type="email"
            placeholder="seu@email.com"
            className="input-field"
            autoComplete="email"
          />
          {errors.email && (
            <p className="error-message">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="label">Senha</label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="input-field pr-10"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="error-message">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full btn-primary justify-center py-2.5"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      {/* Demo hint */}
      <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-medium text-slate-500 mb-2">
          Credenciais de demonstração:
        </p>
        <div className="space-y-1 text-xs text-slate-600">
          <div className="flex justify-between">
            <span className="font-medium">Admin:</span>
            <span>admin@bellaClinica.com</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Atendente:</span>
            <span>juliana@bellaClinica.com</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Senha:</span>
            <span>admin123</span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        © 2025 MedCRM. Todos os direitos reservados.
      </p>
    </div>
  );
}
