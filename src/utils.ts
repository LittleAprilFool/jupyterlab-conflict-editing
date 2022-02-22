export const random = (length = 8) => {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const color_list = {} as any;

export const generateColor = (id: string) => {
  if (color_list[id]) {
    return color_list[id];
  } else {
    const color = randomColor();
    color_list[id] = color;
    return color;
  }
};

export const randomColor = () => {
  const r = 100 + Math.floor(Math.random() * 150);
  const g = 100 + Math.floor(Math.random() * 150);
  const b = 100 + Math.floor(Math.random() * 150);
  return `rgb(${r}, ${g}, ${b})`;
};
