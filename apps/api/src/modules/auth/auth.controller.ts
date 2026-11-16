import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, registerSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.validator';
import { sendSuccess } from '../../utils/response';

export class AuthController {
  static async register(req: Request, res: Response) {
    const data = registerSchema.parse(req.body);
    const result = await AuthService.register(data);
    sendSuccess(res, result, 201, 'Registration successful');
  }

  static async login(req: Request, res: Response) {
    const data = loginSchema.parse(req.body);
    const result = await AuthService.login(data.email, data.password);
    sendSuccess(res, result, 200, 'Login successful');
  }

  static async refresh(req: Request, res: Response) {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await AuthService.refresh(refreshToken);
    sendSuccess(res, result, 200, 'Token refreshed');
  }

  static async forgotPassword(req: Request, res: Response) {
    const { email } = forgotPasswordSchema.parse(req.body);
    await AuthService.requestPasswordReset(email);
    sendSuccess(res, null, 200, 'If an active account exists for that email, a reset link will be sent.');
  }

  static async resetPassword(req: Request, res: Response) {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await AuthService.resetPassword(token, password);
    sendSuccess(res, null, 200, 'Password reset successfully');
  }

  static async me(req: Request, res: Response) {
    const user = await AuthService.getMe(req.user!.userId);
    sendSuccess(res, user);
  }
}
