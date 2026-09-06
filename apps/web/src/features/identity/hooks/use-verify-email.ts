import { useMutation } from '@tanstack/react-query';
import { verifyEmail } from '../api/auth-api';

export function useVerifyEmail() {
  return useMutation({ mutationFn: verifyEmail });
}
