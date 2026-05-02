import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account & Sign In',
  description: 'Sign in to your Readest account and manage cloud library storage.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
