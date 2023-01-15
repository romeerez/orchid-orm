export class FileChanges {
  private ranges: ([from: number, to: number] | string)[] = [];

  constructor(public content: string) {}

  add(at: number, text: string, end = at) {
    if (this.ranges.length === 0) {
      this.ranges.push([0, at], text, [end, this.content.length]);
    } else {
      const last = this.ranges[this.ranges.length - 1] as [number, number];
      last[1] = at;
      this.ranges.push(text, [end, this.content.length]);
    }
  }

  replace(from: number, to: number, text: string) {
    this.add(from, text, to);
  }

  remove(from: number, to: number) {
    if (this.ranges.length === 0) {
      this.ranges.push([0, from], [to, this.content.length]);
    } else {
      const last = this.ranges[this.ranges.length - 1] as [number, number];
      last[1] = from;
      this.ranges.push([to, this.content.length]);
    }
  }

  apply() {
    return this.ranges.length
      ? this.ranges
          .map((item) =>
            typeof item === 'string'
              ? item
              : this.content.slice(item[0], item[1]),
          )
          .join('')
      : this.content;
  }
}
