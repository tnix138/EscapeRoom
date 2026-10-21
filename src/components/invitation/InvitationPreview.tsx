'use client';

import { useState } from 'react';
import InvitationCardVideo from './InvitationCardVideo';

export default function InvitationPreview({ name, seat }: { name: string; seat: string }) {
  const [play, setPlay] = useState(0);
  const [finished, setFinished] = useState(false);
  if (finished) {
    return <main className="invitation-finish"><span className="finish-ornament">✳</span><p className="invitation-kicker"><span /> پیش‌نمایش · {seat}</p><h1>این شب، به نامِ شماست.</h1><p>{name}، کارت دعوت شما آماده است. در اجرای واقعی، حالا وارد کوچهٔ تماشاخانه می‌شوید.</p><button className="invitation-primary" onClick={() => { setFinished(false); setPlay((value) => value + 1); }}>پخش دوبارهٔ دعوت‌نامه</button></main>;
  }
  return <InvitationCardVideo key={play} playerName={name} seatLabel={seat} onComplete={() => setFinished(true)} />;
}
