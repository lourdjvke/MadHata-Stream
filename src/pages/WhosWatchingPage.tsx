import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, rtdb } from '../firebase.ts';
import { useAuth, AVATAR_PALETTE, UserProfile } from '../context/AuthContext.tsx';
import '../styles/whosWatching.css';

export const WhosWatchingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, profile: currentProfile } = useAuth();

  const [cur, setCur] = useState<'name' | 'acct' | 'login' | 'done'>('name');
  const [av, setAv] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [acctEmail, setAcctEmail] = useState('');
  const [acctPassword, setAcctPassword] = useState('');
  const [showAcctPw, setShowAcctPw] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Error states
  const [nameError, setNameError] = useState('');
  const [acctEmailError, setAcctEmailError] = useState('');
  const [acctPwError, setAcctPwError] = useState('');
  const [loginEmailError, setLoginEmailError] = useState('');
  const [loginPwError, setLoginPwError] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Success texts
  const [doneTitle, setDoneTitle] = useState('Welcome');
  const [doneSub, setDoneSub] = useState('Your profile is ready.');

  // Password strength
  const [pwStrength, setPwStrength] = useState(0);

  // Refs for animation and DOM manipulation
  const rootRef = useRef<HTMLDivElement>(null);
  const avwRef = useRef<HTMLDivElement>(null);
  const avbRef = useRef<HTMLButtonElement>(null);
  const eyesRef = useRef<SVGGElement>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const acctEmailRef = useRef<HTMLInputElement>(null);
  const acctPwRef = useRef<HTMLInputElement>(null);
  const loginEmailRef = useRef<HTMLInputElement>(null);
  const loginPwRef = useRef<HTMLInputElement>(null);

  const pNameRef = useRef<HTMLElement>(null);
  const pAcctRef = useRef<HTMLElement>(null);
  const pLoginRef = useRef<HTMLElement>(null);
  const pDoneRef = useRef<HTMLElement>(null);

  // Set initial colors
  const paint = (idx: number) => {
    if (rootRef.current) {
      rootRef.current.style.setProperty('--c1', AVATAR_PALETTE[idx][0]);
      rootRef.current.style.setProperty('--c2', AVATAR_PALETTE[idx][1]);
    }
  };

  useEffect(() => {
    paint(av);
  }, [av]);

  // If already authenticated and visiting, initialize avatar & name
  useEffect(() => {
    if (currentUser && currentProfile) {
      if (typeof currentProfile.avatarIndex === 'number') {
        setAv(currentProfile.avatarIndex);
        paint(currentProfile.avatarIndex);
      }
      setName(currentProfile.name || currentUser.displayName || '');
    }
  }, [currentUser, currentProfile]);

  // Initial focus
  useEffect(() => {
    const timer = setTimeout(() => {
      nameInputRef.current?.focus({ preventScroll: true });
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  const look = (x: string | number, y: string | number) => {
    if (eyesRef.current) {
      eyesRef.current.style.setProperty('--lx', `${x}px`);
      eyesRef.current.style.setProperty('--ly', `${y}px`);
    }
  };

  // Avatar click: change color
  const handleAvatarClick = () => {
    const next = (av + 1) % AVATAR_PALETTE.length;
    setAv(next);
    paint(next);

    const calm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (!calm && avbRef.current) {
      avbRef.current.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.12) rotate(-4deg)' },
          { transform: 'scale(1)' },
        ],
        { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' }
      );
    }
  };

  // Eyes follow pointer
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (document.activeElement && document.activeElement.matches('input')) return;
      if (!avwRef.current) return;
      const r = avwRef.current.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      look(
        Math.max(-8, Math.min(8, dx * 30)).toFixed(1),
        Math.max(-5, Math.min(7, dy * 20)).toFixed(1)
      );
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  // Avatar sad on error
  const triggerSad = () => {
    if (!avwRef.current) return;
    avwRef.current.classList.add('sad');
    setTimeout(() => {
      avwRef.current?.classList.remove('sad');
    }, 1400);
  };

  // Shake input
  const shakeInput = (inp: HTMLInputElement | null) => {
    if (!inp) return;
    const calm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (!calm) {
      inp.animate(
        [
          { transform: 'none' },
          { transform: 'translateX(-7px)' },
          { transform: 'translateX(7px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'none' },
        ],
        { duration: 380 }
      );
    }
  };

  const [slideDir, setSlideDir] = useState<1 | -1>(1);

  // Navigation transition between panels
  const go = (to: 'name' | 'acct' | 'login' | 'done', dir: 1 | -1 = 1) => {
    if (to === cur || busy) return;
    setBusy(true);
    setSlideDir(dir);
    setCur(to);
    setTimeout(() => setBusy(false), 450);

    if (to === 'done') {
      avwRef.current?.classList.add('done');
    } else {
      avwRef.current?.classList.remove('done');
    }

    setTimeout(() => {
      if (to === 'name') nameInputRef.current?.focus({ preventScroll: true });
      if (to === 'acct') acctEmailRef.current?.focus({ preventScroll: true });
      if (to === 'login') loginEmailRef.current?.focus({ preventScroll: true });
    }, 250);
  };

  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  const finish = (title: string, sub: string) => {
    setDoneTitle(title);
    setDoneSub(sub);
    go('done', 1);

    setTimeout(() => {
      if (avwRef.current) {
        avwRef.current.classList.add('big');
        avwRef.current.classList.remove('cheer');
        void avwRef.current.offsetWidth;
        avwRef.current.classList.add('cheer');
      }
    }, 500);
  };

  // Step 1: Name submit
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setNameError('Enter a name to continue.');
      shakeInput(nameInputRef.current);
      triggerSad();
      return;
    }
    setNameError('');
    go('acct', 1);
  };

  // Password calculation
  const handleAcctPasswordChange = (val: string) => {
    setAcctPassword(val);
    setAcctPwError('');
    let l = 0;
    if (val.length >= 8) l++;
    if (/[a-z]/.test(val) && /[A-Z]/.test(val)) l++;
    if (/\d/.test(val)) l++;
    if (/[^A-Za-z0-9]/.test(val)) l++;
    setPwStrength(val ? Math.max(1, l) : 0);
  };

  // Step 2: Create account submit
  const handleAcctSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!emailOk(acctEmail.trim())) {
      setAcctEmailError('Enter a valid email address.');
      shakeInput(acctEmailRef.current);
      triggerSad();
      valid = false;
    } else {
      setAcctEmailError('');
    }

    if (acctPassword.length < 8) {
      setAcctPwError('Use at least 8 characters.');
      shakeInput(acctPwRef.current);
      triggerSad();
      valid = false;
    } else {
      setAcctPwError('');
    }

    if (!valid) return;

    setLoading(true);
    try {
      // Real Firebase Auth account creation
      const userCredential = await createUserWithEmailAndPassword(auth, acctEmail.trim(), acctPassword);
      const user = userCredential.user;

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: name.trim(),
      });

      // Save user profile to Firebase Realtime Database
      const profileData: UserProfile = {
        name: name.trim(),
        email: acctEmail.trim(),
        avatarIndex: av,
        c1: AVATAR_PALETTE[av][0],
        c2: AVATAR_PALETTE[av][1],
        createdAt: Date.now(),
      };
      await set(ref(rtdb, `users/${user.uid}/profile`), profileData);

      finish(`Welcome, ${name.trim()}!`, 'Your profile is ready. Enjoy the show.');
    } catch (err: unknown) {
      console.error('Firebase Auth signup error:', err);
      const fbErr = err as { code?: string; message?: string };
      let msg = 'Failed to create account. Please try again.';
      if (fbErr.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please log in.';
      } else if (fbErr.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (fbErr.code === 'auth/weak-password') {
        msg = 'Password is too weak. Use letters, numbers, and symbols.';
      }
      setAcctEmailError(msg);
      shakeInput(acctEmailRef.current);
      triggerSad();
    } finally {
      setLoading(false);
    }
  };

  // Continue as Guest (Firebase Anonymous Auth)
  const handleGuestSignIn = async () => {
    setGuestLoading(true);
    setNameError('');
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      const guestName = name.trim() || 'Guest';

      try {
        await updateProfile(user, { displayName: guestName });
      } catch (pErr) {
        console.warn('Could not update guest profile name:', pErr);
      }

      const profileData: UserProfile = {
        name: guestName,
        email: '',
        avatarIndex: av,
        c1: AVATAR_PALETTE[av][0],
        c2: AVATAR_PALETTE[av][1],
        createdAt: Date.now(),
      };

      try {
        await set(ref(rtdb, `users/${user.uid}/profile`), profileData);
      } catch (dbErr) {
        console.warn('Could not save guest profile to RTDB:', dbErr);
      }

      finish(`Welcome, ${guestName}!`, 'Your guest session is ready. Enjoy the show.');
    } catch (err: unknown) {
      console.error('Anonymous sign-in error:', err);
      const fbErr = err as { code?: string; message?: string };
      let msg = 'Failed to continue as guest. Please try again.';
      if (fbErr.code === 'auth/operation-not-allowed' || fbErr.code === 'auth/admin-restricted-operation') {
        msg = 'Anonymous sign-in is being enabled. Please try again in a moment.';
      } else if (fbErr.message) {
        msg = fbErr.message;
      }
      setNameError(msg);
      shakeInput(nameInputRef.current);
      triggerSad();
    } finally {
      setGuestLoading(false);
    }
  };

  // Sign up with Google
  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setAcctEmailError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Save credentials with the name set by the user before going to that step
      const chosenName = name.trim() || user.displayName || 'Viewer';

      if (name.trim()) {
        try {
          await updateProfile(user, { displayName: name.trim() });
        } catch (pErr) {
          console.warn('Could not update Google profile displayName:', pErr);
        }
      }

      const profileData: UserProfile = {
        name: chosenName,
        email: user.email || '',
        avatarIndex: av,
        c1: AVATAR_PALETTE[av][0],
        c2: AVATAR_PALETTE[av][1],
        createdAt: Date.now(),
      };

      try {
        await set(ref(rtdb, `users/${user.uid}/profile`), profileData);
      } catch (dbErr) {
        console.warn('Could not save Google profile to RTDB:', dbErr);
      }

      finish(`Welcome, ${chosenName}!`, 'Your profile is ready. Enjoy the show.');
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      const fbErr = err as { code?: string; message?: string };
      let msg = 'Google sign-up failed. Please try again.';
      if (fbErr.code === 'auth/popup-closed-by-user' || fbErr.code === 'auth/cancelled-popup-request') {
        msg = 'Google sign-up was cancelled.';
      } else if (fbErr.code === 'auth/popup-blocked') {
        msg = 'Sign-up popup was blocked by browser. Please enable popups.';
      } else if (fbErr.code === 'auth/account-exists-with-different-credential') {
        msg = 'An account already exists with this email address.';
      } else if (fbErr.message) {
        msg = fbErr.message;
      }
      setAcctEmailError(msg);
      shakeInput(acctEmailRef.current);
      triggerSad();
    } finally {
      setGoogleLoading(false);
    }
  };

  // Step 3: Login submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!emailOk(loginEmail.trim())) {
      setLoginEmailError('Enter a valid email address.');
      shakeInput(loginEmailRef.current);
      triggerSad();
      valid = false;
    } else {
      setLoginEmailError('');
    }

    if (!loginPassword) {
      setLoginPwError('Enter your password.');
      shakeInput(loginPwRef.current);
      triggerSad();
      valid = false;
    } else {
      setLoginPwError('');
    }

    if (!valid) return;

    setLoading(true);
    try {
      // Real Firebase Auth sign in
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      const user = userCredential.user;

      // Retrieve profile from Firebase Realtime Database
      try {
        const userRef = ref(rtdb, `users/${user.uid}/profile`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val() as UserProfile;
          if (typeof data.avatarIndex === 'number' && AVATAR_PALETTE[data.avatarIndex]) {
            setAv(data.avatarIndex);
            paint(data.avatarIndex);
          }
          if (data.name) {
            setName(data.name);
          }
        }
      } catch (dbErr) {
        console.warn('Could not read user profile from RTDB:', dbErr);
      }

      finish('Welcome back!', 'You are logged in. Pick up where you left off.');
    } catch (err: unknown) {
      console.error('Firebase Auth login error:', err);
      const fbErr = err as { code?: string; message?: string };
      let msg = 'Invalid email or password.';
      if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (fbErr.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please try again later.';
      }
      setLoginPwError(msg);
      shakeInput(loginPwRef.current);
      triggerSad();
    } finally {
      setLoading(false);
    }
  };

  // Forgot password
  const handleForgotPassword = async () => {
    const email = loginEmail.trim();
    if (!emailOk(email)) {
      setLoginEmailError('Enter your email above to receive a password reset link.');
      shakeInput(loginEmailRef.current);
      triggerSad();
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMsg('Password reset email sent! Check your inbox.');
      setTimeout(() => setResetMsg(''), 5000);
    } catch (err: unknown) {
      const fbErr = err as { code?: string };
      if (fbErr.code === 'auth/user-not-found') {
        setLoginEmailError('No user found with this email.');
      } else {
        setLoginEmailError('Failed to send reset email. Try again.');
      }
      triggerSad();
    }
  };

  // Start watching navigation
  const handleStartWatching = () => {
    const from = (location.state as { from?: string })?.from || '/';
    navigate(from, { replace: true });
  };

  return (
    <div className="whos-watching-root" ref={rootRef}>
      {/* SVG Definitions */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="eye" viewBox="0 0 24 24">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </symbol>
          <symbol id="eyeoff" viewBox="0 0 24 24">
            <path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.4 6.5A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </symbol>
          <symbol id="ck" viewBox="0 0 24 24">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </symbol>
          <symbol id="pen" viewBox="0 0 24 24">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </symbol>
        </defs>
      </svg>

      {/* Top Bar */}
      <header className="bar">
        <div className="brand">
          <span className="logo">M</span>
          <span><b>MadHata</b> original</span>
        </div>
        {cur !== 'acct' && cur !== 'done' && (
          <button
            className="tb"
            id="tb"
            type="button"
            onClick={() => go(cur === 'login' ? 'name' : 'login', cur === 'login' ? -1 : 1)}
          >
            {cur === 'login' ? 'Sign up' : 'Login'}
          </button>
        )}
      </header>

      {/* Main Stage */}
      <main>
        <div className="stage">
          {/* Avatar View */}
          <div className="avw" id="avw" ref={avwRef}>
            <div className="glow" />
            <button
              className="avb"
              id="avb"
              ref={avbRef}
              type="button"
              aria-label="Change profile colour"
              onClick={handleAvatarClick}
            >
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
                    <stop className="s1" offset="0" style={{ stopColor: 'var(--c1)' }} />
                    <stop className="s2" offset="1" style={{ stopColor: 'var(--c2)' }} />
                  </linearGradient>
                </defs>
                <rect width="200" height="200" rx="44" fill="url(#ag)" />
                <g className="eyes" id="eyes" ref={eyesRef}>
                  <rect className="eye" x="54" y="62" width="19" height="34" rx="9.5" />
                  <rect className="eye" x="127" y="62" width="19" height="34" rx="9.5" />
                </g>
                <path className="smile" d="M52 124Q100 168 148 124" />
              </svg>
            </button>
            <span className="pen">
              <svg className="i">
                <use href="#pen" />
              </svg>
            </span>
            <span className="ok">
              <svg className="i">
                <use href="#ck" />
              </svg>
            </span>
          </div>

          {/* Panels */}
          <div className="panels">
            {/* Step 1: Who is watching? */}
            <section
              className={`panel ${cur === 'name' ? (slideDir === 1 ? 'slide-in-right' : 'slide-in-left') : ''}`}
              id="p-name"
              ref={pNameRef}
              aria-labelledby="h-name"
              hidden={cur !== 'name'}
            >
              <h1 id="h-name">Who is watching?</h1>
              <p className="sub">Create your profile to start watching.</p>
              <form id="f-name" onSubmit={handleNameSubmit} noValidate>
                <div className="fld">
                  <input
                    className="in"
                    id="name"
                    ref={nameInputRef}
                    aria-label="Name"
                    name="name"
                    placeholder="Name"
                    maxLength={24}
                    autoComplete="nickname"
                    enterKeyHint="next"
                    value={name}
                    aria-invalid={!!nameError}
                    onChange={(e) => {
                      const n = e.target.value;
                      setName(n);
                      avwRef.current?.classList.toggle('big', n.length > 0);
                      look(((Math.min(n.length, 14) / 14 - 0.5) * 14).toFixed(1), 4);
                      if (n.length) setNameError('');
                    }}
                    onFocus={() => look(0, 4)}
                  />
                  <div className="err" id="e-name" aria-live="polite">
                    {nameError}
                  </div>
                </div>
                <button className="btn" type="submit">
                  <span className="sp" />
                  <span className="t">Continue</span>
                </button>
              </form>
              <div className="links">
                <span>Already have an account?</span>
                <button className="lk" type="button" onClick={() => go('login', 1)}>
                  Login
                </button>
              </div>

              <div className="guest-wrap">
                <button
                  className={`guest-btn ${guestLoading ? 'ld' : ''}`}
                  type="button"
                  onClick={handleGuestSignIn}
                  disabled={guestLoading || loading}
                >
                  <span className="guest-sp" />
                  <span className="guest-txt">
                    {guestLoading ? 'Continuing as guest...' : 'Continue as guest'}
                  </span>
                </button>
              </div>
            </section>

            {/* Step 2: Email + Password */}
            <section
              className={`panel ${cur === 'acct' ? (slideDir === 1 ? 'slide-in-right' : 'slide-in-left') : ''}`}
              id="p-acct"
              ref={pAcctRef}
              aria-labelledby="h-acct"
              hidden={cur !== 'acct'}
            >
              <h1 id="h-acct">Hi, {name || 'there'}</h1>
              <p className="sub">Add your email and a password to save your profile.</p>
              <form id="f-acct" onSubmit={handleAcctSubmit} noValidate>
                <div className="fld">
                  <input
                    className="in"
                    id="a-mail"
                    ref={acctEmailRef}
                    type="email"
                    placeholder="Email"
                    autoComplete="email"
                    inputMode="email"
                    aria-label="Email"
                    value={acctEmail}
                    aria-invalid={!!acctEmailError}
                    onChange={(e) => {
                      setAcctEmail(e.target.value);
                      setAcctEmailError('');
                    }}
                    onFocus={() => look(0, 4)}
                  />
                  <div className="err" aria-live="polite">
                    {acctEmailError}
                  </div>
                </div>

                <div className="fld">
                  <input
                    className="in pw"
                    id="a-pass"
                    ref={acctPwRef}
                    type={showAcctPw ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete="new-password"
                    aria-label="Password"
                    value={acctPassword}
                    aria-invalid={!!acctPwError}
                    onChange={(e) => handleAcctPasswordChange(e.target.value)}
                    onFocus={() => {
                      look(0, 4);
                      if (!showAcctPw) avwRef.current?.classList.add('shy');
                    }}
                    onBlur={() => avwRef.current?.classList.remove('shy')}
                  />
                  <button
                    className="eyeb"
                    type="button"
                    aria-label={showAcctPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showAcctPw}
                    onClick={() => {
                      setShowAcctPw(!showAcctPw);
                      avwRef.current?.classList.toggle('shy', showAcctPw);
                      acctPwRef.current?.focus({ preventScroll: true });
                    }}
                  >
                    <svg className="i on">
                      <use href="#eye" />
                    </svg>
                    <svg className="i off">
                      <use href="#eyeoff" />
                    </svg>
                  </button>
                  <div className="sm" id="sm" data-l={pwStrength}>
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="hint">Use 8 or more characters with a mix of letters and numbers.</div>
                  <div className="err" aria-live="polite">
                    {acctPwError}
                  </div>
                </div>

                <button className={`btn ${loading ? 'ld' : ''}`} type="submit" disabled={loading}>
                  <span className="sp" />
                  <span className="t">{loading ? 'Creating account...' : 'Create account'}</span>
                </button>

                <div className="or-divider">
                  <span>or</span>
                </div>

                <button
                  className={`btn-google ${googleLoading ? 'ld' : ''}`}
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={loading || googleLoading}
                >
                  <span className="sp" />
                  <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span className="t">{googleLoading ? 'Connecting...' : 'Sign up with Google'}</span>
                </button>
              </form>

              <div className="links">
                <button className="lk mut" type="button" onClick={() => go('name', -1)}>
                  ← Change name
                </button>
                <span>·</span>
                <button className="lk mut" type="button" onClick={() => go('login', 1)}>
                  I have an account
                </button>
              </div>
              <p className="terms">By continuing you agree to the Terms of Use and Privacy Policy.</p>
            </section>

            {/* Step 3: Login */}
            <section
              className={`panel ${cur === 'login' ? (slideDir === 1 ? 'slide-in-right' : 'slide-in-left') : ''}`}
              id="p-login"
              ref={pLoginRef}
              aria-labelledby="h-login"
              hidden={cur !== 'login'}
            >
              <h1 id="h-login">Welcome back</h1>
              <p className="sub">Log in to pick up where you left off.</p>
              <form id="f-login" onSubmit={handleLoginSubmit} noValidate>
                <div className="fld">
                  <input
                    className="in"
                    id="l-mail"
                    ref={loginEmailRef}
                    type="email"
                    placeholder="Email"
                    autoComplete="email"
                    inputMode="email"
                    aria-label="Email"
                    value={loginEmail}
                    aria-invalid={!!loginEmailError}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      setLoginEmailError('');
                    }}
                    onFocus={() => look(0, 4)}
                  />
                  <div className="err" aria-live="polite">
                    {loginEmailError}
                  </div>
                </div>

                <div className="fld">
                  <input
                    className="in pw"
                    id="l-pass"
                    ref={loginPwRef}
                    type={showLoginPw ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete="current-password"
                    aria-label="Password"
                    value={loginPassword}
                    aria-invalid={!!loginPwError}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginPwError('');
                    }}
                    onFocus={() => {
                      look(0, 4);
                      if (!showLoginPw) avwRef.current?.classList.add('shy');
                    }}
                    onBlur={() => avwRef.current?.classList.remove('shy')}
                  />
                  <button
                    className="eyeb"
                    type="button"
                    aria-label={showLoginPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showLoginPw}
                    onClick={() => {
                      setShowLoginPw(!showLoginPw);
                      avwRef.current?.classList.toggle('shy', showLoginPw);
                      loginPwRef.current?.focus({ preventScroll: true });
                    }}
                  >
                    <svg className="i on">
                      <use href="#eye" />
                    </svg>
                    <svg className="i off">
                      <use href="#eyeoff" />
                    </svg>
                  </button>
                  <div className="err" aria-live="polite">
                    {loginPwError}
                  </div>
                  {resetMsg && <div className="msg">{resetMsg}</div>}
                </div>

                <button className="fgt lk mut" type="button" onClick={handleForgotPassword}>
                  Forgot password?
                </button>

                <button className={`btn ${loading ? 'ld' : ''}`} type="submit" disabled={loading}>
                  <span className="sp" />
                  <span className="t">{loading ? 'Logging in...' : 'Log in'}</span>
                </button>
              </form>

              <div className="links">
                <span>New here?</span>
                <button className="lk" type="button" onClick={() => go('name', -1)}>
                  Create a profile
                </button>
              </div>
            </section>

            {/* Step 4: Success / Ready */}
            <section
              className={`panel ${cur === 'done' ? (slideDir === 1 ? 'slide-in-right' : 'slide-in-left') : ''}`}
              id="p-done"
              ref={pDoneRef}
              aria-labelledby="h-done"
              hidden={cur !== 'done'}
            >
              <h1 id="h-done">{doneTitle}</h1>
              <p className="sub" id="s-done">
                {doneSub}
              </p>
              <button className="btn" type="button" id="start" onClick={handleStartWatching}>
                <span className="t">Start watching</span>
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};
