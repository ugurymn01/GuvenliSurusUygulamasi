// SafeDrive kelime markası — simge yok, yanında küçük primary nokta.
export default function Logo({ size = 18 }) {
  return (
    <span className="brand" style={{ fontSize: size }}>
      SafeDrive
      <span className="brand-dot" />
    </span>
  );
}
