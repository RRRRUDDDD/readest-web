import { availableTransformers } from './transformers';
import { TransformContext } from './transformers/types';

const isThenable = (value: unknown): value is PromiseLike<string> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PromiseLike<string>).then === 'function';

export const transformContent = async (ctx: TransformContext): Promise<string> => {
  let transformed = ctx.content;

  const activeTransformers = ctx.transformers
    .map((name) => availableTransformers.find((transformer) => transformer.name === name))
    .filter((transformer) => !!transformer);
  for (const transformer of activeTransformers) {
    try {
      // Most transformers do only synchronous string/regex/DOM work but
      // were historically declared `async`, paying one microtask hop per
      // step. We now allow `string | Promise<string>` and only `await`
      // when a real thenable is returned, so a fully sync chain runs in
      // a single tick.
      const result = transformer.transform({ ...ctx, content: transformed });
      transformed = isThenable(result) ? await result : result;
    } catch (error) {
      console.warn(`Error in transformer ${transformer.name}:`, error);
    }
  }

  return transformed;
};
