// ./robin-base-tools/src/privy-auth.ts

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useBaseAccountSdk } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';

export const usePrivyAuth = () => {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { baseAccountSdk } = useBaseAccountSdk();
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (wallets && wallets.length > 0) {
      setAddress(wallets[0].address);
    } else {
      setAddress(null);
    }
  }, [wallets]);

  const loginWithEmail = async (email: string) => {
    // Implement login with email and embedded wallet creation here
    // Use privy.users().create() and privy.wallets().create()
    console.log("Logging in with email: ", email);
  };

  return {
    ready,
    authenticated,
    login,
    logout,
    user,
    address,
    loginWithEmail,
    baseAccountSdk
  };
};

// Example component that uses the hook
/*
function MyComponent() {
  const { ready, authenticated, login, logout, user, address, loginWithEmail } = usePrivyAuth();

  if (!ready) return <div>Loading...</div>;

  if (!authenticated) {
    return (
      <div>
        <button onClick={() => loginWithEmail('user@example.com')}>Login with Email</button>
      </div>
    );
  }

  return (
    <div>
      <p>User ID: {user?.id}</p>
      <p>Address: {address}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
*/