interface Props {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ on, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-9 h-[18px] rounded-full transition-colors disabled:opacity-40 ${
        on ? 'bg-signal/70' : 'bg-slate-700'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white/90 transition-transform ${
          on ? 'translate-x-[18px]' : ''
        }`}
      />
    </button>
  );
}