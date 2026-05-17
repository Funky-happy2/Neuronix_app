export function renderMentions(text: string, myUsername?: string | null): React.ReactNode {
  if (!text) return text;
  const parts = text.split(/(#[\w-]+)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (!part.startsWith("#")) return part;
        const name = part.slice(1);
        const isMe = myUsername && name.toLowerCase() === myUsername.toLowerCase();
        return (
          <span
            key={i}
            className={
              isMe
                ? "font-bold px-1 rounded bg-amber-400/25 text-amber-600 dark:text-amber-300 ring-1 ring-amber-400/50"
                : "font-bold text-blue-500 dark:text-blue-400"
            }
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

export function UserNameDisplay({
  username,
  displayName,
  nameClassName = "",
}: {
  username: string;
  displayName?: string | null;
  nameClassName?: string;
}) {
  const hasDisplayName = displayName && displayName !== username;
  return (
    <span className="flex flex-col leading-tight min-w-0">
      <span className={`font-bold truncate ${nameClassName}`}>
        {hasDisplayName ? displayName : username}
      </span>
      <span className="text-[10px] text-muted-foreground truncate">@{username}</span>
    </span>
  );
}
