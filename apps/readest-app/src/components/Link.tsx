interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  title?: string;
}

const Link: React.FC<LinkProps> = ({ href, children, ...props }) => {
  return (
    <a href={href} target='_blank' rel='noopener noreferrer' {...props}>
      {children}
    </a>
  );
};

export default Link;
