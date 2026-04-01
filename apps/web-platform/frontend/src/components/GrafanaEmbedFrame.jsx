function GrafanaEmbedFrame({ title, src }) {
  return (
    <iframe
      title={title}
      src={src}
      className="infra-embed-frame"
      frameBorder="0"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

export default GrafanaEmbedFrame;
