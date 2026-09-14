import { expect, test } from "bun:test";
import { articleContentSchema, articleUpdateSchema } from "@/lib/articles/schemas";

test("single-field article patches never introduce creation defaults", () => {
  const current = {author:"Editor",title:"Original",description:"Original summary",blocks:[{id:"body",type:"text" as const,content:"Keep this body."}],commentsEnabled:false,coverUrl:"https://example.com/image.jpg"};
  for (const patch of [{description:"Revised summary"},{title:"Revised title"},{commentsEnabled:true},{coverUrl:null},{targetOaConnectionId:null}]) {
    const parsed = articleUpdateSchema.parse(patch);
    expect(parsed).toEqual(patch);
    expect({...current,...parsed}).toEqual({...current,...patch});
  }
  expect(articleUpdateSchema.safeParse({}).success).toBe(false);
  expect(articleUpdateSchema.parse({blocks:[],author:"",title:"",description:""})).toEqual({blocks:[],author:"",title:"",description:""});
  expect(articleContentSchema.parse({})).toEqual({author:"",title:"",description:"",blocks:[],commentsEnabled:true});
});
