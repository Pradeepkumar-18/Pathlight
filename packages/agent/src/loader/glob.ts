// `PATHLIGHT_TRACKER_INCLUDE` / `_EXCLUDE` globs (`architecture.md` §8), matched against project
// paths with `/` separators. Supports `**`, `*`, `?` and `{a,b}`: enough for file globs, written
// in-house instead of adding a dependency.

export function globToRegExp(glob: string): RegExp {
  let out = '';
  let braces = 0;
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] ?? '';
    if (char === '*') {
      if (glob[i + 1] === '*') {
        // `**/` matches zero or more folders; a trailing `**` matches everything below.
        const slash = glob[i + 2] === '/';
        out += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else out += '[^/]*';
    } else if (char === '?') out += '[^/]';
    else if (char === '{') {
      braces += 1;
      out += '(?:';
    } else if (char === '}' && braces > 0) {
      braces -= 1;
      out += ')';
    } else if (char === ',' && braces > 0) out += '|';
    else out += char.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/** True when `file` matches an include glob and no exclude glob. */
export function createMatcher(
  include: readonly string[],
  exclude: readonly string[],
): (file: string) => boolean {
  const including = include.map(globToRegExp);
  const excluding = exclude.map(globToRegExp);
  return (file) =>
    including.some((glob) => glob.test(file)) && !excluding.some((glob) => glob.test(file));
}
