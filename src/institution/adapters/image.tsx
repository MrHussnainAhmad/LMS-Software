import type { ImgHTMLAttributes } from 'react';
export default function Image({ fill, priority: _priority, unoptimized: _unoptimized, quality: _quality, placeholder: _placeholder, blurDataURL: _blur, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean; quality?: number; placeholder?: string; blurDataURL?: string }) {
  return <img {...props} style={{ ...(fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const : {}), ...props.style }} />;
}
