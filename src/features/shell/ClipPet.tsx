export function ClipPet({ paused }: { paused: boolean }) {
  return (
    <svg
      className="clip-pet"
      data-paused={paused || undefined}
      data-testid="clip-pet"
      viewBox="0 0 56 56"
      aria-hidden="true"
    >
      <path
        className="clip-pet__tail"
        d="M42 35c7 0 9 5 6 9-2 3-6 3-9 1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        className="clip-pet__body"
        d="M14 9h24c5 0 8 3 8 8v21c0 5-3 8-8 8H17c-5 0-8-3-8-8V17c0-5 2-8 5-8Z"
      />
      <path className="clip-pet__fold" d="M9 35h8c3 0 5 2 5 5v6" />
      <path
        className="clip-pet__clip"
        d="M17 17v-5c0-5 8-5 8 0v8c0 5-7 5-7 0v-6"
        fill="none"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <g className="clip-pet__face">
        <g className="clip-pet__eyes">
          <ellipse cx="23" cy="28" rx="2.6" ry="3.2" />
          <ellipse cx="35" cy="28" rx="2.6" ry="3.2" />
          <circle cx="22.2" cy="27.1" r=".7" className="clip-pet__eye-glint" />
          <circle cx="34.2" cy="27.1" r=".7" className="clip-pet__eye-glint" />
        </g>
        <path className="clip-pet__rest-eyes" d="M20 29c2 2 4 2 6 0m6 0c2 2 4 2 6 0" />
        <path className="clip-pet__mouth" d="M27 35c1.5 1.5 3 1.5 4.5 0" />
        <circle className="clip-pet__cheek" cx="18" cy="33" r="2" />
        <circle className="clip-pet__cheek" cx="40" cy="33" r="2" />
      </g>
    </svg>
  );
}
