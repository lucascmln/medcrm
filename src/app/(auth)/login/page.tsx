"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { BrandMark } from "@/components/shared/BrandMark";

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
    <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 p-8 animate-fade-in">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
          <BrandMark size={64} rounded="rounded-2xl" priority className="shadow-lg shadow-brand-900/20" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900">InnoveCRM</h1>
        <p className="text-slate-500 text-sm mt-1.5">
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

      <p className="text-center text-xs text-slate-400 mt-6">
        © 2026 InnoveCRM · uma solução Innove Doctors
      </p>
    </div>
  );
}
