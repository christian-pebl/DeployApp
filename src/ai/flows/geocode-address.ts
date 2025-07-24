'use server';

/**
 * @fileOverview A geocoding AI agent.
 *
 * - geocodeAddress - A function that handles the geocoding process.
 * - GeocodeAddressInput - The input type for the geocodeAddress function.
 * - GeocodeAddressOutput - The return type for the geocodeAddress function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeocodeAddressInputSchema = z.object({
  address: z.string().describe('The address or location description to geocode.'),
});
export type GeocodeAddressInput = z.infer<typeof GeocodeAddressInputSchema>;

const GeocodeAddressOutputSchema = z.object({
  latitude: z.number().describe('The latitude of the geocoded address.'),
  longitude: z.number().describe('The longitude of the geocoded address.'),
});
export type GeocodeAddressOutput = z.infer<typeof GeocodeAddressOutputSchema>;

export async function geocodeAddress(input: GeocodeAddressInput): Promise<GeocodeAddressOutput> {
  return geocodeAddressFlow(input);
}

const prompt = ai.definePrompt({
  name: 'geocodeAddressPrompt',
  input: {schema: GeocodeAddressInputSchema},
  output: {schema: GeocodeAddressOutputSchema},
  prompt: `You are a geocoding expert.  Given an address or location description, you will convert it to latitude and longitude coordinates.

Address: {{{address}}}`,
});

const geocodeAddressFlow = ai.defineFlow(
  {
    name: 'geocodeAddressFlow',
    inputSchema: GeocodeAddressInputSchema,
    outputSchema: GeocodeAddressOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
