export default function CameraGuide({ text }) {
  return (
    <div className="camera-guide" aria-hidden="true">
      <div className="camera-guide-frame">{text || 'Alinea el locker dentro del marco guia.'}</div>
    </div>
  );
}
