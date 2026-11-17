import { AgePipePipe } from './age-pipe.pipe';

describe('AgePipePipe', () => {
  let pipe = new AgePipePipe();

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2021, 10, 17));
  });

  afterEach(() => jasmine.clock().uninstall());

  it('create an instance', () => {  
    expect(pipe).toBeTruthy();
  });

  it('calculates 21 years for an April 2000 birth at the fixed reference date',()=>{
    let value: Date=new Date(2000,3,15);
    expect(pipe.transform(value)).toBe(21);
  });

  it('calculates 16 years for an April 2005 birth at the fixed reference date',()=>{
    let value: Date=new Date(2005,3,14);
    expect(pipe.transform(value)).toBe(16);
  });
});
