'use client';

export function Loader({ size = 200 }: { size?: number }) {
  const scale = size / 200;
  return (
    <>
      <div className="loader-wrap" style={{ width: size, height: size }}>
        <div className="loader">
          <div className="circle" />
        </div>
      </div>
      <style jsx>{`
        .loader-wrap {
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loader {
          position: relative;
          width: 200px;
          height: 200px;
          flex-shrink: 0;
          transform: scale(${scale});
          transform-origin: center;
        }
        .circle {
          position: absolute;
          inset: 35px;
          background: #ffffff;
          border-radius: 50%;
          transform-style: preserve-3d;
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.15);
        }
        .circle::before {
          content: '';
          position: absolute;
          inset: 4px;
          background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 40%, #ec4899 100%);
          border-radius: 50%;
          animation: anim 2s linear infinite;
        }
        .circle::after {
          content: '';
          position: absolute;
          inset: 25px;
          filter: blur(0.5px);
          background: #ffffff;
          border-radius: 50%;
          z-index: 10;
        }
        @keyframes anim {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
