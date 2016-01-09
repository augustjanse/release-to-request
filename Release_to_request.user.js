// ==UserScript==
// @name        Release to request
// @description	Import metadata from a MusicBrainz release group into a What.CD request
// @namespace   http://janse.se/
// @include     https://what.cd/requests.php?action=new
// @version     0.1
// @grant       none
// ==/UserScript==

$("tbody").prepend('<tr> <td class="label">Import from MusicBrainz</td> <td> <input id="mbid_box" size="8" value="" type="text"> <input value="Import" id="mbid_button" type="button"> </td> </tr>');
$("#mbid_button").click(Import);

function Import(){
	var input = $("#mbid_box").val();
	var mbid = input.match("[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+")[0];
	var url = 'http://musicbrainz.org/release-group/' + mbid;
	$.get('https://musicbrainz.org/ws/2/release-group/' + mbid + '?inc=artists', function(xml) {
		// get metadata from XML
		var artist = $(xml).find("name").text();	
		var title = $(xml).find("title").text();
		var date = $(xml).find("first-release-date").text();
		var type = $(xml).find("release-group").attr("type");

		// enter metadata in form
		$('[name="artists[]"]').val(artist);	
		$('[name="title"]').val(title);	
		$('[name="year"]').val(date);	
		var dd_val = $('select option').filter(function () { return $(this).html() == type;}).val(); 
		$('#releasetype').val(dd_val);

		})

	// allow all formats, bitrates and media
	$('#toggle_formats').click();
	$('#toggle_bitrates').click();
	$('#toggle_media').click();

}

